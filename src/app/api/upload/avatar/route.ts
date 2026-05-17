import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createPresignedUpload, isR2Configured } from "@/lib/storage/r2";

// Limite plus serrée pour les avatars (vs course-thumbnail) : 2 MB
// largement suffisant pour une photo de profil après compression côté
// client / serveur. Évite que des users uploadent du 8 MB juste pour
// leur avatar (gaspillage stockage + bande passante).
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

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
  // Pas de restriction de rôle : tout user connecté peut uploader son avatar.

  if (!isR2Configured()) {
    return NextResponse.json(
      {
        error:
          "Stockage non configuré. Renseignez R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY et R2_PUBLIC_URL dans .env.",
      },
      { status: 503 },
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
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "Format non supporté. Utilisez JPEG, PNG, WebP ou AVIF." },
      { status: 400 },
    );
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
    return NextResponse.json(
      { error: `Fichier trop lourd (max ${MAX_BYTES / (1024 * 1024)} MB).` },
      { status: 400 },
    );
  }

  try {
    const result = await createPresignedUpload({
      prefix: `avatars/${session.user.id}`,
      filename,
      contentType,
      maxSizeBytes: sizeBytes,
      expiresInSeconds: 60,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[upload/avatar]", err);
    return NextResponse.json(
      { error: "Échec de la génération de l'URL d'upload." },
      { status: 500 },
    );
  }
}
