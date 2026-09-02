"use server";

// Server Actions admin pour la gestion des cours.

import { revalidatePath, updateTag } from "next/cache";

import { requireAnyAdminRole } from "@/lib/auth/authorization";
import { executeCourseDeletion } from "@/lib/domain/course-deletion";
import { failedCriteriaLabels } from "@/lib/validators/course-publish";
import { prisma } from "@/lib/prisma";
import { managedCourseObjectFromUrl } from "@/lib/storage/course-media-provenance";
import { nanoid } from "nanoid";
import { createAuditLog } from "@/server/services/audit-log";
import { cleanupDeletedCourseMedia } from "@/server/services/course-media-cleanup";
import { deleteCourseRecordIfUnused } from "@/server/services/course-deletion";
import type { CourseStatus } from "@/generated/prisma/enums";

import type { ActionResult } from "./auth";

// Invalide les caches publics (home, /cours, /categories) qui dépendent du
// catalogue. À appeler après tout passage PUBLISHED ↔ DRAFT/ARCHIVED/REJECTED
// ou changement de mise en avant.
function invalidateCatalogCaches() {
  updateTag("courses");
  updateTag("categories");
  revalidatePath("/");
  revalidatePath("/cours");
}

// Modération de cours : ADMIN ou MODERATOR.
const requireAdmin = () => requireAnyAdminRole("ADMIN", "MODERATOR");

async function audit(
  actorId: string,
  action: string,
  targetId: string,
  metadata?: Record<string, unknown>,
) {
  await createAuditLog({
    actorId,
    action,
    targetType: "Course",
    targetId,
    metadata: metadata ?? null,
  });
}

const MODERATABLE_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "REJECTED",
] as const satisfies readonly CourseStatus[];

type ModeratableStatus = (typeof MODERATABLE_STATUSES)[number];

function isModeratableStatus(value: unknown): value is ModeratableStatus {
  return typeof value === "string" && MODERATABLE_STATUSES.some((status) => status === value);
}

function statusSuccessMessage(status: ModeratableStatus): string {
  switch (status) {
    case "PUBLISHED":
      return "La formation a été publiée avec succès.";
    case "REJECTED":
      return "La formation a été refusée et le formateur a été notifié.";
    case "PENDING_REVIEW":
      return "La formation est maintenant en attente de révision.";
    case "DRAFT":
      return "La formation a été replacée en brouillon.";
  }
}

async function performCourseStatusTransition(
  actorId: string,
  courseId: string,
  nextStatus: ModeratableStatus,
  rejectionReason?: string,
): Promise<ActionResult> {
  const reason = rejectionReason?.trim() ?? "";
  if (nextStatus === "REJECTED" && reason.length < 10) {
    return {
      success: false,
      message: "Le motif de rejet doit faire au moins 10 caractères.",
      fieldErrors: { reason: ["Le motif doit faire au moins 10 caractères."] },
    };
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      instructorId: true,
      slug: true,
      title: true,
      status: true,
      description: true,
      thumbnailUrl: true,
      sections: { select: { lessons: { select: { id: true } } } },
    },
  });
  if (!course) return { success: false, message: "Formation introuvable." };
  if (course.status === nextStatus) {
    return { success: false, message: "La formation possède déjà ce statut." };
  }

  if (nextStatus === "PUBLISHED") {
    const failed = failedCriteriaLabels(course);
    if (failed.length > 0) {
      return {
        success: false,
        message: `Publication refusée — critères qualité non remplis : ${failed.join(" · ")}.`,
      };
    }
  }

  const oldStatus = course.status;
  const notification = (() => {
    switch (nextStatus) {
      case "PUBLISHED":
        return {
          kind: "COURSE_PUBLISHED" as const,
          title: "Votre formation est publiée",
          body: `« ${course.title} » est désormais visible dans le catalogue.`,
          url: `/cours/${course.slug}`,
        };
      case "REJECTED":
        return {
          kind: "COURSE_REJECTED" as const,
          title: "Votre formation nécessite des modifications",
          body: reason,
          url: `/formateur/cours/${course.id}`,
        };
      case "PENDING_REVIEW":
        return {
          kind: "GENERIC" as const,
          title: "Formation en cours de révision",
          body: `Le statut de « ${course.title} » a été remis en attente de révision.`,
          url: `/formateur/cours/${course.id}`,
        };
      case "DRAFT":
        return {
          kind: "GENERIC" as const,
          title: "Formation replacée en brouillon",
          body: `« ${course.title} » a été replacé en brouillon par l’équipe de modération.`,
          url: `/formateur/cours/${course.id}`,
        };
    }
  })();

  await prisma.$transaction([
    prisma.course.update({
      where: { id: course.id },
      data: {
        status: nextStatus,
        publishedAt: nextStatus === "PUBLISHED" ? new Date() : null,
        rejectionReason: nextStatus === "REJECTED" ? reason : null,
      },
    }),
    prisma.notification.create({
      data: { userId: course.instructorId, ...notification },
    }),
  ]);

  await audit(actorId, "course.status-change", course.id, {
    oldStatus,
    newStatus: nextStatus,
    ...(nextStatus === "REJECTED" ? { reason } : {}),
  });

  revalidatePath("/admin/cours");
  revalidatePath(`/admin/cours/${course.id}`);
  revalidatePath("/admin/cours/moderation");
  revalidatePath("/formateur");
  revalidatePath("/formateur/cours");
  revalidatePath(`/formateur/cours/${course.id}`);
  revalidatePath(`/cours/${course.slug}`);
  if (oldStatus === "PUBLISHED" || nextStatus === "PUBLISHED") {
    invalidateCatalogCaches();
  }
  return { success: true, message: statusSuccessMessage(nextStatus) };
}

export async function transitionCourseStatus(
  courseId: string,
  _previousState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const nextStatus = formData.get("status");
  if (!isModeratableStatus(nextStatus)) {
    return { success: false, message: "Statut de formation invalide." };
  }
  return performCourseStatusTransition(
    admin.userId,
    courseId,
    nextStatus,
    String(formData.get("reason") ?? ""),
  );
}

export async function approveCourse(courseId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  return performCourseStatusTransition(admin.userId, courseId, "PUBLISHED");
}

export async function rejectCourse(
  courseId: string,
  reason: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  return performCourseStatusTransition(admin.userId, courseId, "REJECTED", reason);
}

export async function unpublishCourse(courseId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.course.update({
    where: { id: courseId },
    data: { status: "ARCHIVED" },
  });
  await audit(admin.userId, "course.unpublish", courseId);
  revalidatePath("/admin/cours");
  invalidateCatalogCaches();
  return { success: true, message: "Formation archivée." };
}

export async function toggleFeaturedCourse(
  courseId: string,
  featured: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  let nextOrder: number | null = null;
  if (featured) {
    const max = await prisma.course.aggregate({
      _max: { featuredOrder: true },
      where: { isFeatured: true },
    });
    nextOrder = (max._max.featuredOrder ?? 0) + 1;
  }
  await prisma.course.update({
    where: { id: courseId },
    data: {
      isFeatured: featured,
      featuredOrder: featured ? nextOrder : null,
    },
  });
  await audit(admin.userId, "course.feature", courseId, { featured });
  revalidatePath("/admin/cours");
  revalidatePath(`/admin/cours/${courseId}`);
  revalidatePath("/admin/cours/featured");
  invalidateCatalogCaches();
  return { success: true, message: featured ? "Formation mise en avant." : "Retirée de la vitrine." };
}

export async function bulkUnpublish(courseIds: string[]): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (courseIds.length === 0) {
    return { success: false, message: "Aucune formation sélectionnée." };
  }
  await prisma.course.updateMany({
    where: { id: { in: courseIds } },
    data: { status: "ARCHIVED" },
  });
  for (const id of courseIds) {
    await audit(admin.userId, "course.bulk-unpublish", id);
  }
  revalidatePath("/admin/cours");
  return {
    success: true,
    message: `${courseIds.length} formation${courseIds.length > 1 ? "s" : ""} archivée${courseIds.length > 1 ? "s" : ""}.`,
  };
}

export async function bulkPublish(courseIds: string[]): Promise<ActionResult> {
  if (courseIds.length === 0) return { success: false, message: "Aucune formation sélectionnée." };
  for (const id of courseIds) {
    const result = await approveCourse(id);
    if (!result.success) return result;
  }
  return { success: true, message: `${courseIds.length} formation${courseIds.length > 1 ? "s" : ""} publiée${courseIds.length > 1 ? "s" : ""}.` };
}

export async function duplicateCourse(courseId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const source = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      tags: { select: { id: true } },
      sections: {
        orderBy: { displayOrder: "asc" },
        include: {
          lessons: {
            orderBy: { displayOrder: "asc" },
            include: { resources: true },
          },
        },
      },
    },
  });
  if (!source) return { success: false, message: "Formation introuvable." };

  const copy = await prisma.course.create({
    data: {
      slug: `${source.slug}-copie-${nanoid(6).toLowerCase()}`,
      title: `${source.title} — copie`,
      subtitle: source.subtitle,
      description: source.description,
      thumbnailUrl: source.thumbnailUrl,
      heroBackgroundUrl: source.heroBackgroundUrl,
      level: source.level,
      language: source.language,
      durationSeconds: source.durationSeconds,
      priceEUR: source.priceEUR,
      priceUSD: source.priceUSD,
      priceGNF: source.priceGNF,
      priceXOF: source.priceXOF,
      metaTitle: source.metaTitle,
      metaDescription: source.metaDescription,
      whatYouWillLearn: source.whatYouWillLearn,
      requirements: source.requirements,
      targetAudience: source.targetAudience,
      status: "DRAFT",
      instructorId: source.instructorId,
      categoryId: source.categoryId,
      tags: { connect: source.tags },
      sections: {
        create: source.sections.map((section) => ({
          title: section.title,
          description: section.description,
          displayOrder: section.displayOrder,
          lessons: {
            create: section.lessons.map((lesson) => ({
              title: lesson.title,
              description: lesson.description,
              type: lesson.type,
              displayOrder: lesson.displayOrder,
              isFreePreview: lesson.isFreePreview,
              externalVideoUrl: lesson.externalVideoUrl,
              textContent: lesson.textContent,
              resourceUrl: lesson.resourceUrl,
              resourceFileName: lesson.resourceFileName,
              transcript: lesson.transcript,
              resources: {
                create: lesson.resources.map((resource) => ({
                  title: resource.title,
                  url: resource.url,
                  fileSizeBytes: resource.fileSizeBytes,
                })),
              },
            })),
          },
        })),
      },
    },
  });
  await audit(admin.userId, "course.duplicate", copy.id, { sourceId: courseId });
  revalidatePath("/admin/cours");
  return { success: true, message: "Formation dupliquée en brouillon." };
}

export async function bulkChangeCategory(
  courseIds: string[],
  categoryId: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (courseIds.length === 0) {
    return { success: false, message: "Aucune formation sélectionnée." };
  }
  await prisma.course.updateMany({
    where: { id: { in: courseIds } },
    data: { categoryId },
  });
  for (const id of courseIds) {
    await audit(admin.userId, "course.bulk-category", id, { categoryId });
  }
  revalidatePath("/admin/cours");
  return {
    success: true,
    message: `${courseIds.length} formation${courseIds.length > 1 ? "s" : ""} déplacée${courseIds.length > 1 ? "s" : ""}.`,
  };
}

export async function adminDeleteCourse(courseId: string): Promise<ActionResult> {
  return executeCourseDeletion({
    authorize: () => requireAnyAdminRole("ADMIN"),
    deleteRecord: () => deleteCourseRecordIfUnused(courseId),
    cleanup: cleanupDeletedCourseMedia,
    audit: (actorId, title) => audit(actorId, "course.delete", courseId, { title }),
    onDeleted: () => {
      revalidatePath("/admin/cours");
      revalidatePath(`/admin/cours/${courseId}`);
      invalidateCatalogCaches();
    },
  });
}

export async function setInternalNotesOnCourse(
  courseId: string,
  notes: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.course.update({
    where: { id: courseId },
    data: { internalNotes: notes.trim() || null },
  });
  await audit(admin.userId, "course.internal-notes", courseId);
  revalidatePath(`/admin/cours/${courseId}`);
  return { success: true, message: "Notes internes enregistrées." };
}

const HERO_BACKGROUND_MODES = ["keep", "replace", "default"] as const;
type HeroBackgroundMode = (typeof HERO_BACKGROUND_MODES)[number];

export interface CourseHeroBackgroundActionResult extends ActionResult {
  appliedMode?: HeroBackgroundMode;
  heroBackgroundUrl?: string | null;
}

function isHeroBackgroundMode(value: unknown): value is HeroBackgroundMode {
  return (
    typeof value === "string" &&
    HERO_BACKGROUND_MODES.some((mode) => mode === value)
  );
}

export async function updateCourseHeroBackground(
  courseId: string,
  _previousState: CourseHeroBackgroundActionResult,
  formData: FormData,
): Promise<CourseHeroBackgroundActionResult> {
  const admin = await requireAnyAdminRole("ADMIN", "MODERATOR", "MANAGER");
  const mode = formData.get("heroBackgroundMode");
  if (!isHeroBackgroundMode(mode)) {
    return { success: false, message: "Choix d’image invalide." };
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      slug: true,
      status: true,
      instructorId: true,
      heroBackgroundUrl: true,
    },
  });
  if (!course) return { success: false, message: "Formation introuvable." };

  if (mode === "keep") {
    return {
      success: true,
      message: "Image actuelle conservée.",
      appliedMode: mode,
      heroBackgroundUrl: course.heroBackgroundUrl,
    };
  }

  const nextUrl =
    mode === "default"
      ? null
      : String(formData.get("heroBackgroundUrl") ?? "").trim();

  if (
    mode === "replace" &&
    (!nextUrl ||
      !managedCourseObjectFromUrl(nextUrl, course.instructorId, {
        r2AccountId: process.env.R2_ACCOUNT_ID,
        r2Bucket: process.env.R2_BUCKET ?? "e-formationgn",
        r2PublicUrl: process.env.R2_PUBLIC_URL,
      }))
  ) {
    return {
      success: false,
      message: "Importez une image valide avant d’enregistrer.",
      fieldErrors: {
        heroBackgroundUrl: ["L’image doit provenir de l’espace de stockage de cette formation."],
      },
    };
  }

  if (nextUrl === course.heroBackgroundUrl) {
    return {
      success: true,
      message: nextUrl ? "Image d’arrière-plan inchangée." : "L’image par défaut est déjà utilisée.",
      appliedMode: mode,
      heroBackgroundUrl: course.heroBackgroundUrl,
    };
  }

  await prisma.course.update({
    where: { id: course.id },
    data: { heroBackgroundUrl: nextUrl },
  });
  await audit(admin.userId, "course.hero-background-update", course.id, {
    mode,
    hadCustomImage: Boolean(course.heroBackgroundUrl),
    hasCustomImage: Boolean(nextUrl),
  });

  revalidatePath(`/admin/cours/${course.id}`);
  revalidatePath(`/cours/${course.slug}`);
  if (course.status === "PUBLISHED") updateTag("courses");

  if (course.heroBackgroundUrl) {
    await cleanupDeletedCourseMedia({
      ownerId: course.instructorId,
      muxAssetIds: [],
      storedUrls: [course.heroBackgroundUrl],
    });
  }

  return {
    success: true,
    message: nextUrl
      ? "Image d’arrière-plan enregistrée."
      : "Image par défaut restaurée.",
    appliedMode: mode,
    heroBackgroundUrl: nextUrl,
  };
}
