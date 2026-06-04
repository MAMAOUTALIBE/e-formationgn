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
import { createLocalUpload } from "@/lib/storage/local";
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

// On accepte TOUT format vidéo (video/*) plutôt qu'une liste blanche figée.
function isVideoType(contentType: string): boolean {
  return contentType.startsWith("video/");
}

// Plafond aligné sur la route d'upload local (/api/upload/blob).
const MAX_VIDEO_SIZE = 1024 * 1024 * 1024; // 1 GB

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

  if (!isVideoType(params.contentType)) {
    return {
      ok: false,
      message: "Format non supporté. Choisissez un fichier vidéo.",
    };
  }

  if (params.sizeBytes <= 0 || params.sizeBytes > MAX_VIDEO_SIZE) {
    return {
      ok: false,
      message: `Taille de fichier invalide (max ${Math.round(MAX_VIDEO_SIZE / 1024 / 1024)} MB).`,
    };
  }

  const prefix = `lessons/${params.lessonId}`;
  const useR2 = isR2Configured() && isR2PublicUrlConfigured();

  try {
    // R2 en prod (avec domaine public pour servir la vidéo), sinon fallback
    // disque local (dev / single-host) servi par l'app sur /uploads/.
    const upload = useR2
      ? await createPresignedUpload({
          prefix,
          filename: params.filename,
          contentType: params.contentType,
          maxSizeBytes: params.sizeBytes,
          // Vidéos plus lourdes → fenêtre d'upload plus large.
          expiresInSeconds: 600,
        })
      : createLocalUpload({
          prefix,
          filename: params.filename,
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
