"use server";

// Server Actions pour générer des URLs d'upload signées vers R2.
// Restreintes aux utilisateurs INSTRUCTOR ou ADMIN. Images (5 MB) pour les
// miniatures/avatars ; vidéos de leçon (500 MB) en auto-hébergement R2, en
// alternative à Mux.

import { auth } from "@/auth";
import {
  AuthorizationError,
  requireInstructorOrAdmin,
} from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import {
  createPresignedUpload,
  isR2Configured,
  isR2PublicUrlConfigured,
  type PresignedUploadResult,
} from "@/lib/storage/r2";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime", // .mov
  "video/x-matroska", // .mkv
]);

// Plafond volontairement conservateur pour l'auto-hébergement R2 (vs Mux qui
// gère le gros volume). Ajustable selon le forfait R2.
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB

interface CreatePresignedThumbnailUploadResult {
  ok: boolean;
  message?: string;
  upload?: PresignedUploadResult;
}

export async function createPresignedThumbnailUpload(params: {
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<CreatePresignedThumbnailUploadResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, message: "Connectez-vous." };
  }
  if (
    session.user.role !== "INSTRUCTOR" &&
    session.user.role !== "ADMIN"
  ) {
    return { ok: false, message: "Réservé aux formateurs." };
  }

  if (!isR2Configured()) {
    return {
      ok: false,
      message: "Stockage R2 non configuré. Contactez l'administrateur.",
    };
  }

  if (!ALLOWED_IMAGE_TYPES.has(params.contentType)) {
    return {
      ok: false,
      message: "Type d'image non supporté (JPEG, PNG, WebP, AVIF uniquement).",
    };
  }

  if (params.sizeBytes <= 0 || params.sizeBytes > MAX_IMAGE_SIZE) {
    return {
      ok: false,
      message: `Taille de fichier invalide (max ${Math.round(MAX_IMAGE_SIZE / 1024 / 1024)} MB).`,
    };
  }

  try {
    const upload = await createPresignedUpload({
      prefix: `thumbnails/${session.user.id}`,
      filename: params.filename,
      contentType: params.contentType,
      maxSizeBytes: params.sizeBytes,
      expiresInSeconds: 60,
    });
    return { ok: true, upload };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Échec de la génération d'URL.",
    };
  }
}

interface CreatePresignedLessonVideoUploadResult {
  ok: boolean;
  message?: string;
  upload?: PresignedUploadResult;
}

/**
 * URL signée pour téléverser une vidéo de leçon directement vers R2 (sans
 * transiter par notre serveur). Vérifie la propriété de la leçon. Nécessite
 * R2 configuré ET une URL publique (R2_PUBLIC_URL) pour servir la vidéo.
 */
export async function createPresignedLessonVideoUpload(params: {
  lessonId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<CreatePresignedLessonVideoUploadResult> {
  // RBAC + propriété de la leçon : seul le formateur propriétaire (ou un admin)
  // peut générer une URL d'upload pour cette leçon.
  const ctx = await requireInstructorOrAdmin();
  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    select: { section: { select: { course: { select: { instructorId: true } } } } },
  });
  if (!lesson) {
    throw new AuthorizationError("NOT_FOUND", "Leçon introuvable.");
  }
  if (!ctx.isAdmin && lesson.section.course.instructorId !== ctx.userId) {
    throw new AuthorizationError("FORBIDDEN", "Action non autorisée.");
  }

  if (!isR2Configured() || !isR2PublicUrlConfigured()) {
    return {
      ok: false,
      message:
        "Stockage vidéo non configuré (R2_* et R2_PUBLIC_URL requis). Contactez l'administrateur.",
    };
  }

  if (!ALLOWED_VIDEO_TYPES.has(params.contentType)) {
    return {
      ok: false,
      message: "Format vidéo non supporté (MP4, WebM, MOV, MKV).",
    };
  }

  if (params.sizeBytes <= 0 || params.sizeBytes > MAX_VIDEO_SIZE) {
    return {
      ok: false,
      message: `Taille de fichier invalide (max ${Math.round(MAX_VIDEO_SIZE / 1024 / 1024)} MB).`,
    };
  }

  try {
    const upload = await createPresignedUpload({
      prefix: `lessons/${params.lessonId}`,
      filename: params.filename,
      contentType: params.contentType,
      maxSizeBytes: params.sizeBytes,
      // Vidéos plus lourdes → fenêtre d'upload plus large.
      expiresInSeconds: 600,
    });
    return { ok: true, upload };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Échec de la génération d'URL.",
    };
  }
}
