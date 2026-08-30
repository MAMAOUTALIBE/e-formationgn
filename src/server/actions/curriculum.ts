"use server";

// Server Actions du programme : sections, leçons, et upload Mux.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  AuthorizationError,
  requireCourseOwnership,
  requireInstructorOrAdmin,
  toActionResult,
} from "@/lib/auth/authorization";
import {
  createDirectUpload,
  getAsset,
  getUpload,
  isMuxConfigured,
} from "@/lib/mux";
import { prisma } from "@/lib/prisma";
import { safeDeleteMuxAsset } from "@/server/services/mux-service";
import { normalizeLessonVideoUrl } from "@/lib/youtube";
import {
  lessonResourceSchema,
  lessonSchema,
  lessonVideoUrlSchema,
  reorderItemsSchema,
  sectionSchema,
} from "@/lib/validators/courses-instructor";

import type { ActionResult } from "./auth";

// Alias : la sémantique « est-ce que cet utilisateur peut éditer ce cours ? »
// est centralisée dans `requireCourseOwnership` (lib/auth/authorization).
const requireOwnership = requireCourseOwnership;

/** Plafond de pièces jointes par leçon. */
const MAX_RESOURCES_PER_LESSON = 20;
const RETIRED_RESOURCE_TYPE_MESSAGE =
  "Ajoutez les fichiers avec la carte Ressources téléchargeables.";

// Helpers locaux qui chargent davantage que la version centrale (la relation
// `course` complète + tous les champs lesson/section), pour éviter un second
// findUnique dans les callers. La RBAC reste celle de `requireInstructorOrAdmin`.
async function requireSectionOwnership(sectionId: string) {
  const ctx = await requireInstructorOrAdmin();
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { course: { select: { id: true, instructorId: true } } },
  });
  if (!section) {
    throw new AuthorizationError("NOT_FOUND", "Section introuvable.");
  }
  if (!ctx.isAdmin && section.course.instructorId !== ctx.userId) {
    throw new AuthorizationError("FORBIDDEN", "Action non autorisée.");
  }
  return { section, userId: ctx.userId, isAdmin: ctx.isAdmin };
}

async function requireLessonOwnership(lessonId: string) {
  const ctx = await requireInstructorOrAdmin();
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      section: {
        include: { course: { select: { id: true, instructorId: true } } },
      },
    },
  });
  if (!lesson) {
    throw new AuthorizationError("NOT_FOUND", "Leçon introuvable.");
  }
  if (!ctx.isAdmin && lesson.section.course.instructorId !== ctx.userId) {
    throw new AuthorizationError("FORBIDDEN", "Action non autorisée.");
  }
  return { lesson, userId: ctx.userId, isAdmin: ctx.isAdmin };
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export async function createSection(
  courseId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  await requireOwnership(courseId);

  const parsed = sectionSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const lastOrder = await prisma.section.aggregate({
    where: { courseId },
    _max: { displayOrder: true },
  });

  await prisma.section.create({
    data: {
      courseId,
      title: parsed.data.title,
      description: parsed.data.description ? parsed.data.description : null,
      displayOrder: (lastOrder._max.displayOrder ?? -1) + 1,
    },
  });

  revalidatePath(`/formateur/cours/${courseId}/programme`);
  return { success: true, message: "Section créée." };
}

export async function updateSection(
  sectionId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const { section } = await requireSectionOwnership(sectionId);

  const parsed = sectionSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  await prisma.section.update({
    where: { id: sectionId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description ? parsed.data.description : null,
    },
  });

  revalidatePath(`/formateur/cours/${section.course.id}/programme`);
  return { success: true, message: "Section mise à jour." };
}

export async function deleteSection(sectionId: string): Promise<ActionResult> {
  const { section } = await requireSectionOwnership(sectionId);
  await prisma.section.delete({ where: { id: sectionId } });
  revalidatePath(`/formateur/cours/${section.course.id}/programme`);
  return { success: true, message: "Section supprimée." };
}

export async function reorderSections(
  courseId: string,
  ids: string[],
): Promise<ActionResult> {
  await requireOwnership(courseId);
  const parsed = reorderItemsSchema.safeParse({ ids });
  if (!parsed.success) return { success: false, message: "Liste invalide." };

  await prisma.$transaction(
    parsed.data.ids.map((id, index) =>
      prisma.section.updateMany({
        where: { id, courseId },
        data: { displayOrder: index },
      }),
    ),
  );

  revalidatePath(`/formateur/cours/${courseId}/programme`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Leçons
// ---------------------------------------------------------------------------

export async function createLesson(
  sectionId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult & { lessonId?: string }> {
  const { section } = await requireSectionOwnership(sectionId);

  const parsed = lessonSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type") ?? "VIDEO",
    description: formData.get("description") ?? "",
    textContent: formData.get("textContent") ?? "",
    resourceUrl: formData.get("resourceUrl") ?? "",
    resourceFileName: formData.get("resourceFileName") ?? "",
    isFreePreview: formData.get("isFreePreview") === "on",
  });
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  if (parsed.data.type === "RESOURCE") {
    return {
      success: false,
      message: RETIRED_RESOURCE_TYPE_MESSAGE,
      fieldErrors: { type: [RETIRED_RESOURCE_TYPE_MESSAGE] },
    };
  }

  const lastOrder = await prisma.lesson.aggregate({
    where: { sectionId },
    _max: { displayOrder: true },
  });

  const createdLesson = await prisma.lesson.create({
    data: {
      sectionId,
      title: parsed.data.title,
      type: parsed.data.type,
      description: parsed.data.description ? parsed.data.description : null,
      textContent: parsed.data.textContent ? parsed.data.textContent : null,
      resourceUrl: parsed.data.resourceUrl ? parsed.data.resourceUrl : null,
      resourceFileName: parsed.data.resourceFileName
        ? parsed.data.resourceFileName
        : null,
      isFreePreview: Boolean(parsed.data.isFreePreview),
      displayOrder: (lastOrder._max.displayOrder ?? -1) + 1,
    },
  });

  revalidatePath(`/formateur/cours/${section.course.id}/programme`);
  return {
    success: true,
    message: "Leçon créée.",
    lessonId: createdLesson.id,
  };
}

export async function updateLesson(
  lessonId: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const { lesson } = await requireLessonOwnership(lessonId);

  const parsed = lessonSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type") ?? "VIDEO",
    description: formData.get("description") ?? "",
    textContent: formData.get("textContent") ?? "",
    resourceUrl: formData.get("resourceUrl") ?? "",
    resourceFileName: formData.get("resourceFileName") ?? "",
    isFreePreview: formData.get("isFreePreview") === "on",
  });
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  // Les anciennes leçons RESOURCE restent sauvegardables afin de préserver
  // leurs liens. En revanche, aucune leçon moderne ne peut adopter ce type.
  if (parsed.data.type === "RESOURCE" && lesson.type !== "RESOURCE") {
    return {
      success: false,
      message: RETIRED_RESOURCE_TYPE_MESSAGE,
      fieldErrors: { type: [RETIRED_RESOURCE_TYPE_MESSAGE] },
    };
  }

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      title: parsed.data.title,
      type: parsed.data.type,
      description: parsed.data.description ? parsed.data.description : null,
      textContent: parsed.data.textContent ? parsed.data.textContent : null,
      resourceUrl: parsed.data.resourceUrl ? parsed.data.resourceUrl : null,
      resourceFileName: parsed.data.resourceFileName
        ? parsed.data.resourceFileName
        : null,
      isFreePreview: Boolean(parsed.data.isFreePreview),
    },
  });

  // Recalcule la durée du cours.
  await recomputeCourseDuration(lesson.section.course.id);

  revalidatePath(`/formateur/cours/${lesson.section.course.id}/programme`);
  revalidatePath(
    `/formateur/cours/${lesson.section.course.id}/lecons/${lessonId}`,
  );
  return { success: true, message: "Leçon mise à jour." };
}

export async function deleteLesson(lessonId: string): Promise<ActionResult> {
  const { lesson } = await requireLessonOwnership(lessonId);

  // Supprime l'asset Mux associé (best-effort, retry borné via service).
  if (lesson.muxAssetId) {
    await safeDeleteMuxAsset(lesson.muxAssetId, {
      context: { operation: "delete-lesson", lessonId },
    });
  }

  const courseId = lesson.section.course.id;
  await prisma.lesson.delete({ where: { id: lessonId } });
  await recomputeCourseDuration(courseId);

  revalidatePath(`/formateur/cours/${courseId}/programme`);
  redirect(`/formateur/cours/${courseId}/programme`);
}

// ---------------------------------------------------------------------------
// Duplication (leçon / section). Le contenu est copié ; les bindings Mux ne le
// sont PAS (l'asset appartient à l'original). La copie est ajoutée en fin de
// liste (section pour une leçon, cours pour une section).
// ---------------------------------------------------------------------------

export async function duplicateLesson(lessonId: string): Promise<void> {
  const { lesson } = await requireLessonOwnership(lessonId);

  const lastOrder = await prisma.lesson.aggregate({
    where: { sectionId: lesson.sectionId },
    _max: { displayOrder: true },
  });

  // Les pièces jointes suivent la copie : elles pointent vers le même objet de
  // stockage, ce qui est voulu — dupliquer une leçon ne doit pas re-téléverser
  // ses supports. C'est aussi pourquoi `deleteLessonResource` ne supprime que
  // la ligne, jamais le fichier.
  const resources = await prisma.lessonResource.findMany({
    where: { lessonId },
    orderBy: { createdAt: "asc" },
    select: { title: true, url: true, fileSizeBytes: true },
  });

  await prisma.lesson.create({
    data: {
      resources: resources.length > 0 ? { create: resources } : undefined,
      sectionId: lesson.sectionId,
      title: `${lesson.title} (copie)`,
      description: lesson.description,
      type: lesson.type,
      displayOrder: (lastOrder._max.displayOrder ?? -1) + 1,
      isFreePreview: lesson.isFreePreview,
      videoDurationSeconds: lesson.videoDurationSeconds,
      externalVideoUrl: lesson.externalVideoUrl,
      textContent: lesson.textContent,
      resourceUrl: lesson.resourceUrl,
      resourceFileName: lesson.resourceFileName,
      transcript: lesson.transcript,
      aiSummary: lesson.aiSummary,
      aiSummaryUpdatedAt: lesson.aiSummaryUpdatedAt,
    },
  });

  await recomputeCourseDuration(lesson.section.course.id);
  revalidatePath(`/formateur/cours/${lesson.section.course.id}/programme`);
}

export async function duplicateSection(sectionId: string): Promise<void> {
  const { section } = await requireSectionOwnership(sectionId);

  const full = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      lessons: {
        orderBy: { displayOrder: "asc" },
        include: { resources: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!full) throw new AuthorizationError("NOT_FOUND", "Section introuvable.");

  const lastOrder = await prisma.section.aggregate({
    where: { courseId: section.course.id },
    _max: { displayOrder: true },
  });

  await prisma.section.create({
    data: {
      courseId: section.course.id,
      title: `${full.title} (copie)`,
      description: full.description,
      displayOrder: (lastOrder._max.displayOrder ?? -1) + 1,
      lessons: {
        create: full.lessons.map((l) => ({
          resources:
            l.resources.length > 0
              ? {
                  create: l.resources.map((r) => ({
                    title: r.title,
                    url: r.url,
                    fileSizeBytes: r.fileSizeBytes,
                  })),
                }
              : undefined,
          title: l.title,
          description: l.description,
          type: l.type,
          displayOrder: l.displayOrder,
          isFreePreview: l.isFreePreview,
          videoDurationSeconds: l.videoDurationSeconds,
          externalVideoUrl: l.externalVideoUrl,
          textContent: l.textContent,
          resourceUrl: l.resourceUrl,
          resourceFileName: l.resourceFileName,
          transcript: l.transcript,
          aiSummary: l.aiSummary,
          aiSummaryUpdatedAt: l.aiSummaryUpdatedAt,
        })),
      },
    },
  });

  await recomputeCourseDuration(section.course.id);
  revalidatePath(`/formateur/cours/${section.course.id}/programme`);
}

export async function reorderLessons(
  sectionId: string,
  ids: string[],
): Promise<ActionResult> {
  const { section } = await requireSectionOwnership(sectionId);
  const parsed = reorderItemsSchema.safeParse({ ids });
  if (!parsed.success) return { success: false, message: "Liste invalide." };

  await prisma.$transaction(
    parsed.data.ids.map((id, index) =>
      prisma.lesson.updateMany({
        where: { id, sectionId },
        data: { displayOrder: index },
      }),
    ),
  );

  revalidatePath(`/formateur/cours/${section.course.id}/programme`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Ressources téléchargeables d'une leçon
// ---------------------------------------------------------------------------

/**
 * Rattache un fichier déjà téléversé à une leçon.
 *
 * La route de presign (`/api/upload/lesson-resource`) ne sait pas sur quelle
 * leçon le fichier atterrira : elle vérifie seulement que l'appelant est
 * formateur. C'est donc ici, et seulement ici, qu'on contrôle la propriété du
 * cours — sinon un formateur pourrait déposer une pièce jointe dans le cours
 * d'un confrère en changeant l'identifiant dans la requête.
 */
export async function addLessonResource(
  lessonId: string,
  input: { title: string; url: string; fileSizeBytes?: number },
): Promise<ActionResult> {
  let lesson;
  try {
    ({ lesson } = await requireLessonOwnership(lessonId));
  } catch (error) {
    return toActionResult(error);
  }

  const parsed = lessonResourceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.flatten().fieldErrors.url?.[0] ??
        parsed.error.flatten().fieldErrors.title?.[0] ??
        "Ressource invalide.",
    };
  }

  // Plafond par leçon : la liste est destinée à être lue par l'élève, pas à
  // servir d'espace de stockage.
  const existing = await prisma.lessonResource.count({ where: { lessonId } });
  if (existing >= MAX_RESOURCES_PER_LESSON) {
    return {
      success: false,
      message: `Maximum ${MAX_RESOURCES_PER_LESSON} ressources par leçon.`,
    };
  }

  await prisma.lessonResource.create({
    data: {
      lessonId,
      title: parsed.data.title,
      url: parsed.data.url,
      fileSizeBytes: parsed.data.fileSizeBytes ?? null,
    },
  });

  const courseId = lesson.section.course.id;
  revalidatePath(`/formateur/cours/${courseId}/lecons/${lessonId}`);
  revalidatePath(`/formateur/cours/${courseId}/programme`);
  return { success: true, message: "Ressource ajoutée." };
}

/** Renomme une ressource sans toucher au fichier stocké. */
export async function renameLessonResource(
  resourceId: string,
  title: string,
): Promise<ActionResult> {
  const resource = await prisma.lessonResource.findUnique({
    where: { id: resourceId },
    select: { id: true, lessonId: true },
  });
  if (!resource) return { success: false, message: "Ressource introuvable." };

  let lesson;
  try {
    ({ lesson } = await requireLessonOwnership(resource.lessonId));
  } catch (error) {
    return toActionResult(error);
  }

  const parsed = lessonResourceSchema.shape.title.safeParse(title);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Nom invalide." };
  }

  await prisma.lessonResource.update({
    where: { id: resource.id },
    data: { title: parsed.data },
  });

  const courseId = lesson.section.course.id;
  revalidatePath(`/formateur/cours/${courseId}/lecons/${resource.lessonId}`);
  return { success: true, message: "Ressource renommée." };
}

/**
 * Détache une ressource de la leçon.
 *
 * Le fichier lui-même reste en stockage : il peut avoir été dupliqué avec la
 * leçon (`duplicateLesson`), et supprimer l'objet casserait alors la copie.
 * Le nettoyage des orphelins relève du cron, pas de cette action.
 */
export async function deleteLessonResource(resourceId: string): Promise<ActionResult> {
  const resource = await prisma.lessonResource.findUnique({
    where: { id: resourceId },
    select: { id: true, lessonId: true },
  });
  if (!resource) return { success: true, message: "Ressource déjà supprimée." };

  let lesson;
  try {
    ({ lesson } = await requireLessonOwnership(resource.lessonId));
  } catch (error) {
    return toActionResult(error);
  }

  await prisma.lessonResource.delete({ where: { id: resource.id } });

  const courseId = lesson.section.course.id;
  revalidatePath(`/formateur/cours/${courseId}/lecons/${resource.lessonId}`);
  revalidatePath(`/formateur/cours/${courseId}/programme`);
  return { success: true, message: "Ressource supprimée." };
}

// ---------------------------------------------------------------------------
// Mux upload
// ---------------------------------------------------------------------------

export interface MuxUploadResult {
  ok: boolean;
  uploadId?: string;
  url?: string;
  error?: string;
}

export async function createMuxUploadForLesson(
  lessonId: string,
): Promise<MuxUploadResult> {
  if (!isMuxConfigured()) {
    return {
      ok: false,
      error:
        "Mux n'est pas configuré. Renseignez MUX_TOKEN_ID et MUX_TOKEN_SECRET dans .env, puis redémarrez le serveur.",
    };
  }

  const { lesson } = await requireLessonOwnership(lessonId);

  // Si une vidéo précédente existait, on la supprime côté Mux (retry borné).
  if (lesson.muxAssetId) {
    await safeDeleteMuxAsset(lesson.muxAssetId, {
      context: { operation: "replace-asset", lessonId },
    });
  }

  const corsOrigin =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { uploadId, url } = await createDirectUpload(corsOrigin);

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      muxUploadId: uploadId,
      muxAssetId: null,
      muxPlaybackId: null,
      videoDurationSeconds: 0,
    },
  });

  return { ok: true, uploadId, url };
}

export interface ConfirmMuxUploadResult {
  ok: boolean;
  status: "uploaded" | "processing" | "ready" | "errored";
  assetId?: string;
  playbackId?: string;
  durationSeconds?: number;
  message?: string;
}

export async function confirmMuxUploadForLesson(
  lessonId: string,
): Promise<ConfirmMuxUploadResult> {
  const { lesson } = await requireLessonOwnership(lessonId);
  if (!lesson.muxUploadId) {
    return { ok: false, status: "errored", message: "Aucun upload en cours." };
  }
  if (!isMuxConfigured()) {
    return { ok: false, status: "errored", message: "Mux non configuré." };
  }

  const upload = await getUpload(lesson.muxUploadId);

  // Mux : statuts d'upload typiques = waiting, asset_created, errored, cancelled, timed_out
  if (!upload.assetId) {
    return { ok: true, status: "uploaded" };
  }

  const asset = await getAsset(upload.assetId);

  if (asset.status !== "ready") {
    await prisma.lesson.update({
      where: { id: lessonId },
      data: { muxAssetId: asset.assetId },
    });
    return {
      ok: true,
      status: asset.status === "errored" ? "errored" : "processing",
      assetId: asset.assetId,
    };
  }

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      muxAssetId: asset.assetId,
      muxPlaybackId: asset.playbackId,
      videoDurationSeconds: asset.durationSeconds,
    },
  });

  await recomputeCourseDuration(lesson.section.course.id);

  return {
    ok: true,
    status: "ready",
    assetId: asset.assetId,
    playbackId: asset.playbackId ?? undefined,
    durationSeconds: asset.durationSeconds,
  };
}

export async function detachMuxFromLesson(lessonId: string): Promise<ActionResult> {
  const { lesson } = await requireLessonOwnership(lessonId);

  if (lesson.muxAssetId) {
    await safeDeleteMuxAsset(lesson.muxAssetId, {
      context: { operation: "clear-video", lessonId },
    });
  }

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      muxAssetId: null,
      muxPlaybackId: null,
      muxUploadId: null,
      videoDurationSeconds: 0,
    },
  });

  await recomputeCourseDuration(lesson.section.course.id);

  revalidatePath(`/formateur/cours/${lesson.section.course.id}/programme`);
  return { success: true, message: "Vidéo détachée." };
}

// ---------------------------------------------------------------------------
// Source vidéo « URL externe » / fichier hébergé (R2) au niveau d'une leçon.
// Mux et externalVideoUrl sont mutuellement exclusifs : choisir l'un efface
// l'autre (le player priorise muxPlaybackId, on évite donc les ambiguïtés).
// ---------------------------------------------------------------------------

export async function setLessonExternalVideoUrl(
  lessonId: string,
  url: string,
): Promise<ActionResult> {
  const { lesson } = await requireLessonOwnership(lessonId);

  const parsed = lessonVideoUrlSchema.safeParse({ url });
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.flatten().fieldErrors.url?.[0] ?? "URL invalide.",
    };
  }
  const normalized = normalizeLessonVideoUrl(parsed.data.url);
  if (!normalized.success) return { success: false, message: normalized.message };

  // Si une vidéo Mux existait, on la libère côté Mux (best-effort).
  if (lesson.muxAssetId) {
    await safeDeleteMuxAsset(lesson.muxAssetId, {
      context: { operation: "switch-to-external", lessonId },
    });
  }

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      externalVideoUrl: normalized.url,
      muxAssetId: null,
      muxPlaybackId: null,
      muxUploadId: null,
      // Durée inconnue tant que le player ne l'a pas rapportée (loadedmetadata).
      videoDurationSeconds: 0,
    },
  });

  await recomputeCourseDuration(lesson.section.course.id);

  revalidatePath(`/formateur/cours/${lesson.section.course.id}/programme`);
  revalidatePath(`/formateur/cours/${lesson.section.course.id}/lecons/${lessonId}`);
  return { success: true, message: "Vidéo enregistrée." };
}

export async function clearLessonVideo(lessonId: string): Promise<ActionResult> {
  const { lesson } = await requireLessonOwnership(lessonId);

  if (lesson.muxAssetId) {
    await safeDeleteMuxAsset(lesson.muxAssetId, {
      context: { operation: "clear-lesson-video", lessonId },
    });
  }

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      externalVideoUrl: null,
      muxAssetId: null,
      muxPlaybackId: null,
      muxUploadId: null,
      videoDurationSeconds: 0,
    },
  });

  await recomputeCourseDuration(lesson.section.course.id);

  revalidatePath(`/formateur/cours/${lesson.section.course.id}/programme`);
  revalidatePath(`/formateur/cours/${lesson.section.course.id}/lecons/${lessonId}`);
  return { success: true, message: "Vidéo retirée." };
}

// Persiste la durée d'une leçon à source externe/R2. Appelée par le lecteur
// formateur une fois la métadonnée vidéo chargée (loadedmetadata) — Mux la
// fournit déjà, donc on ne touche pas aux leçons Mux ici.
export async function setLessonVideoDuration(
  lessonId: string,
  durationSeconds: number,
): Promise<ActionResult> {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return { success: false, message: "Durée invalide." };
  }
  const rounded = Math.min(Math.round(durationSeconds), 24 * 3600);

  const { lesson } = await requireLessonOwnership(lessonId);
  // Ne s'applique qu'aux leçons à source externe (Mux gère sa propre durée).
  if (!lesson.externalVideoUrl) {
    return { success: false, message: "Leçon sans source vidéo externe." };
  }

  await prisma.lesson.update({
    where: { id: lessonId },
    data: { videoDurationSeconds: rounded },
  });
  await recomputeCourseDuration(lesson.section.course.id);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Vidéo de présentation (promo) au niveau du cours — utilisée comme
// preview avant achat. Stockage condensé sur deux colonnes seulement :
//   - promoVideoMuxId      : uploadId pendant l'upload, puis assetId une fois
//                            le playback ID disponible.
//   - promoVideoPlaybackId : null pendant l'upload, set quand l'asset est ready.
// On ne suit pas la durée (preview = juste un teaser).

export async function createMuxUploadForCoursePromo(
  courseId: string,
): Promise<MuxUploadResult> {
  if (!isMuxConfigured()) {
    return {
      ok: false,
      error:
        "Mux n'est pas configuré. Renseignez MUX_TOKEN_ID et MUX_TOKEN_SECRET dans .env, puis redémarrez le serveur.",
    };
  }

  const { course } = await requireOwnership(courseId);

  // Si une vidéo précédente était prête (assetId stocké), on la supprime côté Mux.
  const existing = await prisma.course.findUnique({
    where: { id: course.id },
    select: { promoVideoMuxId: true, promoVideoPlaybackId: true },
  });
  if (existing?.promoVideoMuxId && existing.promoVideoPlaybackId) {
    await safeDeleteMuxAsset(existing.promoVideoMuxId, {
      context: { operation: "replace-promo", courseId },
    });
  }

  const corsOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { uploadId, url } = await createDirectUpload(corsOrigin);

  await prisma.course.update({
    where: { id: course.id },
    data: {
      promoVideoMuxId: uploadId,
      promoVideoPlaybackId: null,
    },
  });

  return { ok: true, uploadId, url };
}

export async function confirmMuxUploadForCoursePromo(
  courseId: string,
): Promise<ConfirmMuxUploadResult> {
  const { course } = await requireOwnership(courseId);
  if (!isMuxConfigured()) {
    return { ok: false, status: "errored", message: "Mux non configuré." };
  }

  const current = await prisma.course.findUnique({
    where: { id: course.id },
    select: { promoVideoMuxId: true, promoVideoPlaybackId: true },
  });
  if (!current?.promoVideoMuxId) {
    return { ok: false, status: "errored", message: "Aucun upload en cours." };
  }

  // Si le playbackId existe déjà, l'asset est ready : pas de re-confirm nécessaire.
  if (current.promoVideoPlaybackId) {
    return {
      ok: true,
      status: "ready",
      assetId: current.promoVideoMuxId,
      playbackId: current.promoVideoPlaybackId,
    };
  }

  // Sinon, promoVideoMuxId contient encore l'uploadId : on demande l'asset.
  const upload = await getUpload(current.promoVideoMuxId);
  if (!upload.assetId) {
    return { ok: true, status: "uploaded" };
  }

  const asset = await getAsset(upload.assetId);
  if (asset.status !== "ready") {
    return {
      ok: true,
      status: asset.status === "errored" ? "errored" : "processing",
      assetId: asset.assetId,
    };
  }

  await prisma.course.update({
    where: { id: course.id },
    data: {
      promoVideoMuxId: asset.assetId,
      promoVideoPlaybackId: asset.playbackId,
    },
  });

  return {
    ok: true,
    status: "ready",
    assetId: asset.assetId,
    playbackId: asset.playbackId ?? undefined,
  };
}

export async function detachMuxFromCoursePromo(
  courseId: string,
): Promise<ActionResult> {
  const { course } = await requireOwnership(courseId);

  const current = await prisma.course.findUnique({
    where: { id: course.id },
    select: { promoVideoMuxId: true, promoVideoPlaybackId: true },
  });

  // Si l'asset est ready, on le supprime côté Mux (promoVideoMuxId = assetId).
  if (current?.promoVideoMuxId && current.promoVideoPlaybackId) {
    await safeDeleteMuxAsset(current.promoVideoMuxId, {
      context: { operation: "clear-promo", courseId },
    });
  }

  await prisma.course.update({
    where: { id: course.id },
    data: { promoVideoMuxId: null, promoVideoPlaybackId: null },
  });

  revalidatePath(`/formateur/cours/${course.id}`);
  return { success: true, message: "Vidéo de présentation détachée." };
}

// ---------------------------------------------------------------------------
// Recalcul agrégé
// ---------------------------------------------------------------------------

async function recomputeCourseDuration(courseId: string) {
  const result = await prisma.lesson.aggregate({
    where: {
      section: { courseId },
      type: "VIDEO",
    },
    _sum: { videoDurationSeconds: true },
  });
  await prisma.course.update({
    where: { id: courseId },
    data: { durationSeconds: result._sum.videoDurationSeconds ?? 0 },
  });
}
