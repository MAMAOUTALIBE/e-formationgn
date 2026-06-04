import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createLocalUpload } from "@/lib/storage/local";
import { createPresignedUpload, isR2Configured } from "@/lib/storage/r2";

export const runtime = "nodejs";

// 1 GB — couvre n'importe quelle image et les vidéos. R2 (prod) comme le
// stockage local (dev) acceptent ce plafond.
const MAX_BYTES = 1024 * 1024 * 1024;

// On accepte TOUT format d'image et de vidéo (image/*, video/*) plutôt qu'une
// liste blanche figée.
function isAllowedType(contentType: string): boolean {
  return (
    contentType.startsWith("image/") || contentType.startsWith("video/")
  );
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
  if (!isAllowedType(contentType)) {
    return NextResponse.json(
      { error: "Format non supporté. Choisissez une image ou une vidéo." },
      { status: 400 },
    );
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
    return NextResponse.json(
      { error: `Fichier trop lourd (max ${MAX_BYTES / (1024 * 1024)} MB).` },
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
