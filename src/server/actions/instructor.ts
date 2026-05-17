"use server";

// Server Actions du parcours formateur — devenir formateur, créer/éditer
// un cours, soumettre à modération.
//
// Toutes les actions :
// - vérifient une session valide,
// - vérifient le rôle (INSTRUCTOR ou ADMIN) lorsque pertinent,
// - vérifient la propriété de la ressource avant toute mutation.

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";

import { auth } from "@/auth";
import { requireInstructorOrAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import { appendSlugSuffix, slugify } from "@/lib/slug";
import {
  createCourseSchema,
  updateCourseGeneralSchema,
  updateCoursePricingSchema,
  updateCourseSeoSchema,
} from "@/lib/validators/courses-instructor";
import type { ActionResult } from "./auth";

// ---------------------------------------------------------------------------
// Helpers : RBAC déléguée à `lib/auth/authorization`, on ne garde ici qu'un
// fetch utilitaire pour récupérer le status du cours (pas exposé par le helper
// central qui ne renvoie que { id, instructorId }).
// ---------------------------------------------------------------------------

interface AuthorizedCourseContext {
  userId: string;
  isAdmin: boolean;
}

const requireInstructor = async (): Promise<AuthorizedCourseContext> => {
  const ctx = await requireInstructorOrAdmin();
  return { userId: ctx.userId, isAdmin: ctx.isAdmin };
};

async function ensureCourseOwnership(courseId: string, ctx: AuthorizedCourseContext) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true, status: true },
  });
  if (!course) throw new Error("Cours introuvable.");
  if (!ctx.isAdmin && course.instructorId !== ctx.userId) {
    throw new Error("Vous n'êtes pas le propriétaire de ce cours.");
  }
  return course;
}

// ---------------------------------------------------------------------------
// Devenir formateur (opt-in pour un STUDENT existant)
// ---------------------------------------------------------------------------

export async function becomeInstructor(): Promise<void> {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion?callbackUrl=/devenir-formateur");
  }
  if (!session.user.emailVerified) {
    redirect("/verifier-email");
  }

  if (session.user.role === "INSTRUCTOR" || session.user.role === "ADMIN") {
    redirect("/formateur");
  }

  // Génère un code d'affiliation court et unique.
  let affiliateCode = "";
  for (let i = 0; i < 5; i++) {
    const candidate = nanoid(8).toLowerCase().replace(/[_-]/g, "x");
    const exists = await prisma.user.findUnique({
      where: { affiliateCode: candidate },
      select: { id: true },
    });
    if (!exists) {
      affiliateCode = candidate;
      break;
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      role: "INSTRUCTOR",
      isInstructor: true,
      affiliateCode: affiliateCode || nanoid(10).toLowerCase(),
    },
  });

  revalidatePath("/", "layout");
  updateTag("public-stats");
  redirect("/formateur");
}

// ---------------------------------------------------------------------------
// Création express d'un cours (DRAFT)
// ---------------------------------------------------------------------------

export async function createCourse(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireInstructor();

  const parsed = createCourseSchema.safeParse({
    title: formData.get("title"),
    categoryId: formData.get("categoryId"),
    thumbnailUrl: formData.get("thumbnailUrl") ?? "",
  });
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Veuillez corriger les erreurs ci-dessous.",
    };
  }

  // Slug : titre + suffixe court pour garantir l'unicité.
  const baseSlug = slugify(parsed.data.title);
  const slug = appendSlugSuffix(baseSlug, nanoid(6).toLowerCase());

  const course = await prisma.course.create({
    data: {
      slug,
      title: parsed.data.title,
      description:
        "Décrivez votre cours pour aider les élèves à comprendre ce qu'ils vont apprendre.",
      categoryId: parsed.data.categoryId,
      instructorId: ctx.userId,
      status: "DRAFT",
      level: "ALL_LEVELS",
      thumbnailUrl: parsed.data.thumbnailUrl ? parsed.data.thumbnailUrl : null,
    },
  });

  revalidatePath("/formateur/cours");
  redirect(`/formateur/cours/${course.id}`);
}

// ---------------------------------------------------------------------------
// Mise à jour — informations générales
// ---------------------------------------------------------------------------

export async function updateCourseGeneral(
  courseId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireInstructor();
  const course = await ensureCourseOwnership(courseId, ctx);

  const parsed = updateCourseGeneralSchema.safeParse({
    title: formData.get("title"),
    subtitle: formData.get("subtitle") ?? "",
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    level: formData.get("level"),
    thumbnailUrl: formData.get("thumbnailUrl") ?? "",
  });
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Veuillez corriger les erreurs ci-dessous.",
    };
  }

  const data = parsed.data;
  await prisma.course.update({
    where: { id: courseId },
    data: {
      title: data.title,
      subtitle: data.subtitle ? data.subtitle : null,
      description: data.description,
      categoryId: data.categoryId,
      level: data.level,
      thumbnailUrl: data.thumbnailUrl ? data.thumbnailUrl : null,
    },
  });

  revalidatePath(`/formateur/cours/${courseId}`);
  if (course.status === "PUBLISHED") updateTag("courses");
  return { success: true, message: "Modifications enregistrées." };
}

// ---------------------------------------------------------------------------
// Mise à jour — tarification
// ---------------------------------------------------------------------------

export async function updateCoursePricing(
  courseId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireInstructor();
  const course = await ensureCourseOwnership(courseId, ctx);

  const parsed = updateCoursePricingSchema.safeParse({
    priceEUR: formData.get("priceEUR"),
    priceUSD: formData.get("priceUSD"),
    priceGNF: formData.get("priceGNF") ?? 0,
    priceXOF: formData.get("priceXOF") ?? 0,
    discountPriceEUR: formData.get("discountPriceEUR"),
    discountPriceUSD: formData.get("discountPriceUSD"),
    discountPriceGNF: formData.get("discountPriceGNF"),
    discountPriceXOF: formData.get("discountPriceXOF"),
    discountEndsAt: formData.get("discountEndsAt") ?? "",
  });
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Veuillez corriger les erreurs ci-dessous.",
    };
  }

  const data = parsed.data;
  // Helper : "" / null / undefined → null, sinon Number
  const optNum = (v: number | string | null | undefined): number | null =>
    v === undefined || v === "" || v === null ? null : Number(v);

  await prisma.course.update({
    where: { id: courseId },
    data: {
      priceEUR: data.priceEUR,
      priceUSD: data.priceUSD,
      priceGNF: data.priceGNF,
      priceXOF: data.priceXOF,
      discountPriceEUR: optNum(data.discountPriceEUR),
      discountPriceUSD: optNum(data.discountPriceUSD),
      discountPriceGNF: optNum(data.discountPriceGNF),
      discountPriceXOF: optNum(data.discountPriceXOF),
      discountEndsAt:
        data.discountEndsAt && data.discountEndsAt !== ""
          ? new Date(data.discountEndsAt)
          : null,
    },
  });

  revalidatePath(`/formateur/cours/${courseId}/tarification`);
  if (course.status === "PUBLISHED") updateTag("courses");
  return { success: true, message: "Tarification mise à jour." };
}

// ---------------------------------------------------------------------------
// Mise à jour — SEO et objectifs
// ---------------------------------------------------------------------------

export async function updateCourseSeo(
  courseId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireInstructor();
  await ensureCourseOwnership(courseId, ctx);

  const parsed = updateCourseSeoSchema.safeParse({
    metaTitle: formData.get("metaTitle") ?? "",
    metaDescription: formData.get("metaDescription") ?? "",
    whatYouWillLearn: formData.get("whatYouWillLearn") ?? "",
    requirements: formData.get("requirements") ?? "",
    targetAudience: formData.get("targetAudience") ?? "",
  });
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
      message: "Veuillez corriger les erreurs ci-dessous.",
    };
  }

  const data = parsed.data;
  await prisma.course.update({
    where: { id: courseId },
    data: {
      metaTitle: data.metaTitle ? data.metaTitle : null,
      metaDescription: data.metaDescription ? data.metaDescription : null,
      whatYouWillLearn: data.whatYouWillLearn,
      requirements: data.requirements,
      targetAudience: data.targetAudience,
    },
  });

  revalidatePath(`/formateur/cours/${courseId}/seo`);
  return { success: true, message: "Métadonnées mises à jour." };
}

// ---------------------------------------------------------------------------
// Workflow de modération
// ---------------------------------------------------------------------------

export async function submitCourseForReview(courseId: string): Promise<ActionResult> {
  const ctx = await requireInstructor();
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      sections: { include: { lessons: { select: { id: true } } } },
    },
  });
  if (!course) return { success: false, message: "Cours introuvable." };
  if (!ctx.isAdmin && course.instructorId !== ctx.userId) {
    return { success: false, message: "Action non autorisée." };
  }

  const issues: string[] = [];
  if (!course.title || course.title.trim().length < 5) issues.push("titre incomplet");
  if (!course.description || course.description.trim().length < 50)
    issues.push("description trop courte");
  if (!course.thumbnailUrl) issues.push("image de couverture manquante");
  if (course.sections.length === 0) issues.push("aucune section dans le programme");
  if (course.sections.every((s) => s.lessons.length === 0))
    issues.push("aucune leçon publiée");

  if (issues.length > 0) {
    return {
      success: false,
      message: `Avant publication, complétez : ${issues.join(", ")}.`,
    };
  }

  if (course.status === "PUBLISHED") {
    return { success: false, message: "Ce cours est déjà publié." };
  }
  if (course.status === "PENDING_REVIEW") {
    return {
      success: false,
      message: "Ce cours est déjà en attente de modération.",
    };
  }

  await prisma.course.update({
    where: { id: courseId },
    data: { status: "PENDING_REVIEW", rejectionReason: null },
  });

  revalidatePath(`/formateur/cours/${courseId}`);
  revalidatePath("/formateur/cours");
  return {
    success: true,
    message:
      "Cours soumis à la modération. Vous serez notifié dès qu'il aura été examiné.",
  };
}

export async function withdrawCourseSubmission(courseId: string): Promise<ActionResult> {
  const ctx = await requireInstructor();
  const course = await ensureCourseOwnership(courseId, ctx);

  if (course.status !== "PENDING_REVIEW") {
    return {
      success: false,
      message: "Ce cours n'est pas en attente de modération.",
    };
  }

  await prisma.course.update({
    where: { id: courseId },
    data: { status: "DRAFT" },
  });

  revalidatePath(`/formateur/cours/${courseId}`);
  return { success: true, message: "Soumission annulée. Le cours est repassé en brouillon." };
}

export async function unpublishCourse(courseId: string): Promise<ActionResult> {
  const ctx = await requireInstructor();
  const course = await ensureCourseOwnership(courseId, ctx);
  if (course.status !== "PUBLISHED") {
    return { success: false, message: "Ce cours n'est pas publié." };
  }
  await prisma.course.update({
    where: { id: courseId },
    data: { status: "ARCHIVED" },
  });
  revalidatePath(`/formateur/cours/${courseId}`);
  updateTag("courses");
  return { success: true, message: "Cours archivé. Il n'est plus visible publiquement." };
}

// ---------------------------------------------------------------------------
// Suppression d'un cours en brouillon
// ---------------------------------------------------------------------------

export async function deleteCourse(courseId: string): Promise<ActionResult> {
  const ctx = await requireInstructor();
  const course = await ensureCourseOwnership(courseId, ctx);
  if (course.status === "PUBLISHED" || course.status === "PENDING_REVIEW") {
    return {
      success: false,
      message:
        "Impossible de supprimer un cours publié ou en attente. Archivez-le d'abord.",
    };
  }
  await prisma.course.delete({ where: { id: courseId } });
  revalidatePath("/formateur/cours");
  redirect("/formateur/cours");
}
