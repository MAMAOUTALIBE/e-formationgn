"use server";

// Server Action pour générer une URL d'upload signée vers R2.
// Restreinte aux utilisateurs INSTRUCTOR ou ADMIN. Limite implicitée à
// 5 MB pour les images (les vidéos passent par Mux direct upload).

import { auth } from "@/auth";
import {
  createPresignedUpload,
  isR2Configured,
  type PresignedUploadResult,
} from "@/lib/storage/r2";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

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
