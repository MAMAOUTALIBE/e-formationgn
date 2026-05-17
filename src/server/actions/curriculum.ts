"use server";

// Server Actions du programme : sections, leçons, et upload Mux.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  AuthorizationError,
  requireCourseOwnership,
  requireInstructorOrAdmin,
} from "@/lib/auth/authorization";
import {
  createDirectUpload,
  getAsset,
  getUpload,
  isMuxConfigured,
} from "@/lib/mux";
import { prisma } from "@/lib/prisma";
import { safeDeleteMuxAsset } from "@/server/services/mux-service";
import {
  lessonSchema,
  reorderItemsSchema,
  sectionSchema,
} from "@/lib/validators/courses-instructor";

import type { ActionResult } from "./auth";

// Alias : la sémantique « est-ce que cet utilisateur peut éditer ce cours ? »
// est centralisée dans `requireCourseOwnership` (lib/auth/authorization).
const requireOwnership = requireCourseOwnership;

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
): Promise<ActionResult> {
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

  const lastOrder = await prisma.lesson.aggregate({
    where: { sectionId },
    _max: { displayOrder: true },
  });

  await prisma.lesson.create({
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
  return { success: true, message: "Leçon créée." };
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
