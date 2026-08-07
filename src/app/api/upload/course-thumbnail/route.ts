import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createLocalUpload } from "@/lib/storage/local";
import { createPresignedUpload, isR2Configured } from "@/lib/storage/r2";

export const runtime = "nodejs";

// Plafonds distincts. Une vignette de cours qui pèse un giga-octet n'existe
// pas : le plafond unique de 1 Gio servait la vidéo et laissait, pour les
// images, une marge dont seul un abus pouvait se servir.
const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 Mio
const MAX_VIDEO_BYTES = 1024 * 1024 * 1024; // 1 Gio

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

function isAllowedType(contentType: string): boolean {
  if (DENIED_TYPES.has(contentType.toLowerCase())) return false;
  return contentType.startsWith("image/") || contentType.startsWith("video/");
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
  if (!isAllowedType(contentType) || hasDeniedExtension(filename)) {
    return NextResponse.json(
      { error: "Format non supporté. Choisissez une image ou une vidéo." },
      { status: 400 },
    );
  }
  const maxBytes = contentType.startsWith("video/")
    ? MAX_VIDEO_BYTES
    : MAX_IMAGE_BYTES;
  if (sizeBytes <= 0 || sizeBytes > maxBytes) {
    return NextResponse.json(
      { error: `Fichier trop lourd (max ${Math.round(maxBytes / (1024 * 1024))} Mo).` },
      { status: 400 },
    );
  }

  const prefix = `thumbnails/courses/${session.user.id}`;

  try {
    // R2 en prod si configuré, sinon fallback disque local (dev / single-host).
    const result = isR2Configured()
      ? await createPresignedUpload({
          prefix,
          filename,
          contentType,
          // Le plafond transmis à la signature est CELUI DU SERVEUR, pas la
          // taille annoncée par le client : sinon un appelant déclarant 1 Ko
          // obtiendrait une URL signée qui accepte n'importe quel volume.
          maxSizeBytes: maxBytes,
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
