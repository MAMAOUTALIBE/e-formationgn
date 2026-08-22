import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  isAllowedResourceFile,
  resourceSizeLimitFor,
  resourceUploadContentType,
} from "@/lib/resource-file";
import { createLocalUpload } from "@/lib/storage/local";
import { createPresignedUpload, isR2Configured } from "@/lib/storage/r2";

export const runtime = "nodejs";

// Presign d'une ressource jointe à une leçon : vidéo de n'importe quel format,
// PDF, diaporama, tableur, image, archive, audio.
//
// Comme pour la vignette, cette route ne fait qu'émettre une autorisation
// d'écriture sous un préfixe propre à l'utilisateur : elle ne rattache rien à
// une leçon. C'est `addLessonResource` (Server Action) qui vérifie la
// propriété du cours au moment d'enregistrer l'URL — un formateur ne peut donc
// pas déposer un fichier sur la leçon d'un autre.

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
    return NextResponse.json({ error: "Réservé aux formateurs." }, { status: 403 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const { filename, contentType, sizeBytes } = body;
  if (!filename || typeof sizeBytes !== "number") {
    return NextResponse.json(
      { error: "Champs requis : filename, sizeBytes." },
      { status: 400 },
    );
  }
  if (!isAllowedResourceFile(filename, contentType ?? "")) {
    return NextResponse.json(
      {
        error:
          "Format non supporté. Vidéos de tout format, documents, diaporamas, tableurs, images, archives et audio.",
      },
      { status: 400 },
    );
  }
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ error: "Taille de fichier invalide." }, { status: 400 });
  }
  // `null` pour une vidéo : pas de plafond applicatif, le stockage tranche.
  const sizeLimit = resourceSizeLimitFor(filename, contentType ?? "");
  if (sizeLimit !== null && sizeBytes > sizeLimit) {
    return NextResponse.json(
      { error: `Fichier trop lourd (max ${Math.round(sizeLimit / (1024 * 1024))} Mo).` },
      { status: 400 },
    );
  }

  const uploadContentType = resourceUploadContentType(filename, contentType ?? "");
  const prefix = `resources/lessons/${session.user.id}`;

  try {
    // R2 en prod si configuré, sinon fallback disque local (dev / single-host).
    const result = isR2Configured()
      ? await createPresignedUpload({
          prefix,
          filename,
          contentType: uploadContentType,
          maxSizeBytes: sizeBytes,
          expiresInSeconds: 600,
        })
      : createLocalUpload({ prefix, filename, expiresInSeconds: 600 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[upload/lesson-resource]", err);
    return NextResponse.json(
      { error: "Échec de la génération de l'URL d'upload." },
      { status: 500 },
    );
  }
}
