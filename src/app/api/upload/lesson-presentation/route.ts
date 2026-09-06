import { NextResponse } from "next/server";

import {
  MAX_PRESENTATION_BYTES,
  isAllowedPresentationFile,
  presentationFileError,
  presentationSourcePrefix,
  presentationUploadContentType,
} from "@/lib/presentation-file";
import {
  AuthorizationError,
  requireLessonOwnership,
} from "@/lib/auth/authorization";
import { createPrivateLocalUpload } from "@/lib/storage/private-local";
import {
  createPrivatePresignedUpload,
  isPrivateR2Configured,
  isR2Configured,
} from "@/lib/storage/r2";

export const runtime = "nodejs";

interface RequestBody {
  lessonId?: string;
  filename?: string;
  sizeBytes?: number;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const { lessonId, filename, sizeBytes } = body;
  if (!lessonId || !filename || typeof sizeBytes !== "number") {
    return NextResponse.json(
      { error: "Champs requis : lessonId, filename, sizeBytes." },
      { status: 400 },
    );
  }
  if (!isAllowedPresentationFile(filename)) {
    return NextResponse.json(
      { error: presentationFileError(filename) },
      { status: 400 },
    );
  }
  if (
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes <= 0 ||
    sizeBytes > MAX_PRESENTATION_BYTES
  ) {
    return NextResponse.json(
      { error: "Fichier vide ou trop lourd (100 Mo maximum)." },
      { status: 400 },
    );
  }

  try {
    // L'identifiant de leçon vient du client : la propriété est donc vérifiée
    // avant même d'émettre une autorisation temporaire d'écriture.
    const ownership = await requireLessonOwnership(lessonId);
    if (ownership.lesson.type !== "PRESENTATION") {
      return NextResponse.json(
        { error: "Cette leçon n'est pas un diaporama." },
        { status: 409 },
      );
    }
    const prefix = presentationSourcePrefix(ownership.userId, lessonId);
    const contentType = presentationUploadContentType(filename);
    if (isR2Configured() && !isPrivateR2Configured()) {
      return NextResponse.json(
        { error: "Le stockage privé des diaporamas n'est pas configuré." },
        { status: 503 },
      );
    }
    const upload = isR2Configured()
      ? await createPrivatePresignedUpload({
          prefix,
          filename,
          contentType,
          maxSizeBytes: sizeBytes,
          expiresInSeconds: 600,
        })
      : createPrivateLocalUpload({
          prefix,
          filename,
          expiresInSeconds: 600,
          maxSizeBytes: sizeBytes,
        });

    // Aucun `publicUrl` n'est créé : le PowerPoint source est persisté
    // uniquement par sa clé dans le bucket privé après vérification du PUT.
    return NextResponse.json({
      uploadUrl: upload.uploadUrl,
      sourceKey: upload.key,
      contentType,
      expiresInSeconds: upload.expiresInSeconds,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      const status =
        error.code === "UNAUTHENTICATED"
          ? 401
          : error.code === "FORBIDDEN"
            ? 403
            : 404;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[upload/lesson-presentation]", error);
    return NextResponse.json(
      { error: "Échec de la préparation du téléversement." },
      { status: 500 },
    );
  }
}
