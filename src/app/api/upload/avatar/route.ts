import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { canUpdateProfileIdentity } from "@/lib/profile-update";
import { createLocalUpload } from "@/lib/storage/local";
import { createPresignedUpload, isR2Configured } from "@/lib/storage/r2";

export const runtime = "nodejs";

// Limite plus serrée pour les avatars (vs course-thumbnail) : 2 MB
// largement suffisant pour une photo de profil après compression côté
// client / serveur. Évite que des users uploadent du 8 MB juste pour
// leur avatar (gaspillage stockage + bande passante).
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// SVG écarté : c'est un document XML porteur de script, qui s'exécute dans
// l'origine du domaine de stockage quand on l'ouvre directement. Aucun avatar
// n'en a besoin.
const DENIED_TYPES = new Set([
  "image/svg+xml",
  "image/svg",
  "text/html",
  "application/xhtml+xml",
]);

function isAllowedType(contentType: string): boolean {
  if (DENIED_TYPES.has(contentType.toLowerCase())) return false;
  return contentType.startsWith("image/");
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
  if (!canUpdateProfileIdentity(session.user.role)) {
    return NextResponse.json(
      { error: "La photo de profil d’un apprenant ne peut pas être modifiée." },
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
  if (hasDeniedExtension(filename ?? "")) {
    return NextResponse.json(
      { error: "Format non supporté." },
      { status: 400 },
    );
  }
  if (!isAllowedType(contentType)) {
    return NextResponse.json(
      { error: "Format non supporté. Choisissez une image." },
      { status: 400 },
    );
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
    return NextResponse.json(
      { error: `Fichier trop lourd (max ${MAX_BYTES / (1024 * 1024)} MB).` },
      { status: 400 },
    );
  }

  const prefix = `avatars/${session.user.id}`;

  try {
    // R2 en prod si configuré, sinon fallback disque local (dev / single-host).
    const result = isR2Configured()
      ? await createPresignedUpload({
          prefix,
          filename,
          contentType,
          // Plafond du serveur, pas la taille annoncée : une URL signée sur
          // la valeur du client accepterait n'importe quel volume.
          maxSizeBytes: MAX_BYTES,
          expiresInSeconds: 60,
        })
      : createLocalUpload({ prefix, filename, expiresInSeconds: 60 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[upload/avatar]", err);
    return NextResponse.json(
      { error: "Échec de la génération de l'URL d'upload." },
      { status: 500 },
    );
  }
}
