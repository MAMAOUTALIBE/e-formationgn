import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isAdminRole } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { resourceUploadContentType } from "@/lib/resource-file";
import { resolveLocalStoredFilePath } from "@/lib/storage/local";
import { streamStoredFile } from "@/lib/storage/stream-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Accès aux supports de cours d'une leçon.
//
// Les pièces jointes étaient servies par `/uploads/…`, une route sans aucun
// contrôle : l'adresse d'un support suffisait à l'ouvrir, indéfiniment et
// pour quiconque. Les clés étant tirées au hasard, elles n'étaient pas
// devinables — mais un lien partagé une fois restait valable pour toujours,
// ce qui n'est pas une protection, seulement un délai.
//
// Trois profils sont admis, et le contrôle porte sur la LEÇON demandée, pas
// sur le fichier : l'élève inscrit à la formation, le formateur qui en est
// propriétaire, et l'administration. Un formateur n'est pas inscrit à son
// propre cours — le tester par l'inscription seule lui aurait fermé ses
// propres documents.

const PRIVATE_NO_STORE = "private, max-age=0, must-revalidate";

async function serve(
  request: Request,
  context: { params: Promise<{ lessonId: string; resourceId: string }> },
  headOnly: boolean,
): Promise<Response> {
  const { lessonId, resourceId } = await context.params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const resource = await prisma.lessonResource.findFirst({
    // `lessonId` fait partie du critère : sans lui, l'identifiant d'une
    // ressource suffirait à la lire depuis n'importe quelle leçon dont on est
    // membre, y compris celles d'une autre formation.
    where: { id: resourceId, lessonId },
    select: {
      title: true,
      url: true,
      lesson: {
        select: {
          section: {
            select: { course: { select: { id: true, instructorId: true } } },
          },
        },
      },
    },
  });
  if (!resource) {
    return NextResponse.json({ error: "Ressource introuvable." }, { status: 404 });
  }

  const course = resource.lesson.section.course;
  const userId = session.user.id;
  let allowed = isAdminRole(session.user.role) || course.instructorId === userId;

  if (!allowed) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
      select: { id: true },
    });
    allowed = enrollment !== null;
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "Vous devez être inscrit à cette formation." },
      { status: 403 },
    );
  }

  const contentType = resourceUploadContentType(resource.url, "");
  const isDownload = new URL(request.url).searchParams.get("dl") === "1";

  // Stockage local : lecture directe sur le disque, sans repasser par la
  // route publique — c'est justement elle qu'on cherche à ne plus exposer.
  if (resource.url.startsWith("/uploads/")) {
    const segments = resource.url.replace(/^\/uploads\//, "").split("/");
    const filePath = resolveLocalStoredFilePath(segments);
    if (!filePath) {
      return NextResponse.json({ error: "Ressource introuvable." }, { status: 404 });
    }
    return streamStoredFile({
      filePath,
      contentType,
      request,
      headOnly,
      cacheControl: PRIVATE_NO_STORE,
      downloadName: isDownload ? resource.title : undefined,
    });
  }

  // Stockage objet : on relaie la requête. Signer une URL temporaire aurait
  // évité ce transit, mais produirait de nouveau un lien porteur de son propre
  // droit d'accès, partageable tel quel — exactement ce qu'on retire ici.
  const upstream = await fetch(resource.url, {
    method: headOnly ? "HEAD" : "GET",
    headers: request.headers.get("range")
      ? { range: request.headers.get("range")! }
      : undefined,
    cache: "no-store",
  }).catch(() => null);

  if (!upstream || !upstream.ok) {
    return NextResponse.json(
      { error: "Le fichier n'est pas accessible." },
      { status: 502 },
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", PRIVATE_NO_STORE);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Accept-Ranges", "bytes");
  for (const key of ["content-length", "content-range"]) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  if (isDownload) {
    headers.set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(resource.title)}`,
    );
  }

  return new Response(headOnly ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
}

export function GET(
  request: Request,
  context: { params: Promise<{ lessonId: string; resourceId: string }> },
) {
  return serve(request, context, false);
}

export function HEAD(
  request: Request,
  context: { params: Promise<{ lessonId: string; resourceId: string }> },
) {
  return serve(request, context, true);
}
