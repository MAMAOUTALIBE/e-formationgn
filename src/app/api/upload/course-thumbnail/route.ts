import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createLocalUpload } from "@/lib/storage/local";
import { createPresignedUpload, isR2Configured } from "@/lib/storage/r2";
import { isLikelyVideoFile, videoUploadContentType } from "@/lib/video-file";

export const runtime = "nodejs";

// Plafonds distincts. Une vignette de cours qui pèse un giga-octet n'existe
// pas : le plafond unique de 1 Gio servait la vidéo et laissait, pour les
// images, une marge dont seul un abus pouvait se servir.
const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 Mio

// Types refusés quel que soit le préfixe.
//
// SVG est un document XML : il peut porter du script, et servi depuis le
// domaine de stockage il s'exécute dans l'origine de ce domaine. Aucune
// vignette n'a besoin de ce format.
const DENIED_TYPES = new Set([
  "image/svg+xml",
  "image/svg",
  "text/html",
  "application/xhtml+xml",
]);

function isAllowedType(filename: string, contentType: string): boolean {
  if (DENIED_TYPES.has(contentType.toLowerCase())) return false;
  return contentType.startsWith("image/") || isLikelyVideoFile(filename, contentType);
}

/** Extensions dangereuses, indépendamment du type déclaré. */
function hasDeniedExtension(filename: string): boolean {
  return /\.(svgz?|html?|xhtml|js|mjs|php|phtml)$/i.test(filename.trim());
}

interface RequestBody {
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Réservé aux formateurs." },
      { status: 403 },
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const { filename, contentType, sizeBytes } = body;
  if (!filename || !contentType || typeof sizeBytes !== "number") {
    return NextResponse.json(
      { error: "Champs requis : filename, contentType, sizeBytes." },
      { status: 400 },
    );
  }
  if (!isAllowedType(filename, contentType) || hasDeniedExtension(filename)) {
    return NextResponse.json(
      { error: "Format non supporté. Choisissez une image ou une vidéo." },
      { status: 400 },
    );
  }
  const isVideo = isLikelyVideoFile(filename, contentType);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json(
      { error: "Taille de fichier invalide." },
      { status: 400 },
    );
  }
  if (!isVideo && sizeBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: `Image trop lourde (max ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} Mo).` },
      { status: 400 },
    );
  }

  const uploadContentType = isVideo
    ? videoUploadContentType(filename, contentType)
    : contentType;

  const prefix = `thumbnails/courses/${session.user.id}`;

  try {
    // R2 en prod si configuré, sinon fallback disque local (dev / single-host).
    const result = isR2Configured()
      ? await createPresignedUpload({
          prefix,
          filename,
          contentType: uploadContentType,
          // Lie la signature à la taille exacte annoncée. Les vidéos n'ont
          // plus de plafond applicatif ; R2 applique ses limites physiques.
          maxSizeBytes: sizeBytes,
          // Vidéos potentiellement lourdes → fenêtre d'upload large.
          expiresInSeconds: 600,
        })
      : createLocalUpload({ prefix, filename, expiresInSeconds: 600 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[upload/course-thumbnail]", err);
    return NextResponse.json(
      { error: "Échec de la génération de l'URL d'upload." },
      { status: 500 },
    );
  }
}
