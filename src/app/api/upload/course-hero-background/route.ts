import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createLocalUpload } from "@/lib/storage/local";
import { createPresignedUpload, isR2Configured } from "@/lib/storage/r2";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const ALLOWED_ROLES = new Set(["ADMIN", "MODERATOR", "MANAGER"]);
const DENIED_TYPES = new Set([
  "image/svg+xml",
  "image/svg",
  "text/html",
  "application/xhtml+xml",
]);

interface RequestBody {
  courseId?: string;
  filename?: string;
  contentType?: string;
  sizeBytes?: number;
}

function hasDeniedExtension(filename: string): boolean {
  return /\.(svgz?|html?|xhtml|js|mjs|php|phtml)$/i.test(filename.trim());
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!ALLOWED_ROLES.has(session.user.role)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const { courseId, filename, contentType, sizeBytes } = body;
  if (!courseId || !filename || !contentType || typeof sizeBytes !== "number") {
    return NextResponse.json(
      { error: "Champs requis : courseId, filename, contentType, sizeBytes." },
      { status: 400 },
    );
  }
  if (
    DENIED_TYPES.has(contentType.toLowerCase()) ||
    !contentType.startsWith("image/") ||
    hasDeniedExtension(filename)
  ) {
    return NextResponse.json(
      { error: "Format non supporté. Choisissez une image." },
      { status: 400 },
    );
  }
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image trop lourde (12 Mo maximum)." },
      { status: 400 },
    );
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { instructorId: true },
  });
  if (!course) {
    return NextResponse.json({ error: "Formation introuvable." }, { status: 404 });
  }

  const prefix = `hero-backgrounds/courses/${course.instructorId}`;
  try {
    const result = isR2Configured()
      ? await createPresignedUpload({
          prefix,
          filename,
          contentType,
          maxSizeBytes: sizeBytes,
          expiresInSeconds: 120,
        })
      : createLocalUpload({ prefix, filename, expiresInSeconds: 120 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[upload/course-hero-background]", error);
    return NextResponse.json(
      { error: "Échec de la préparation de l’import." },
      { status: 500 },
    );
  }
}
