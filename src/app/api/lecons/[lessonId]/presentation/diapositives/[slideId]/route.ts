import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getPrivateObjectBytes,
  getPrivateObjectSize,
} from "@/lib/storage/private-object";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SLIDE_IMAGE_BYTES = 50 * 1024 * 1024;

interface RouteContext {
  params: Promise<{ lessonId: string; slideId: string }>;
}

const privateImageHeaders = (size: number) => ({
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Disposition": "inline",
  "Content-Length": String(size),
  "Content-Type": "image/png",
  "X-Content-Type-Options": "nosniff",
});

async function authorizedSlide(lessonId: string, slideId: string) {
  const session = await auth();
  if (!session?.user?.id) return { response: new Response(null, { status: 401 }) };

  const slide = await prisma.presentationSlide.findFirst({
    where: {
      id: slideId,
      presentation: { lessonId, status: "READY" },
    },
    select: {
      imageKey: true,
      presentation: {
        select: {
          lesson: {
            select: {
              section: {
                select: {
                  course: { select: { id: true, instructorId: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!slide) return { response: new Response(null, { status: 404 }) };

  const course = slide.presentation.lesson.section.course;
  const isOwner = course.instructorId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId: session.user.id, courseId: course.id },
      },
      select: { id: true },
    });
    if (!enrollment) return { response: new Response(null, { status: 404 }) };
  }

  return { imageKey: slide.imageKey };
}

export async function HEAD(_request: Request, context: RouteContext) {
  const { lessonId, slideId } = await context.params;
  const authorized = await authorizedSlide(lessonId, slideId);
  if ("response" in authorized) return authorized.response;
  const size = await getPrivateObjectSize(authorized.imageKey);
  if (size === null || size > MAX_SLIDE_IMAGE_BYTES) {
    return new Response(null, { status: 404 });
  }
  return new Response(null, { status: 200, headers: privateImageHeaders(size) });
}

export async function GET(_request: Request, context: RouteContext) {
  const { lessonId, slideId } = await context.params;
  const authorized = await authorizedSlide(lessonId, slideId);
  if ("response" in authorized) return authorized.response;
  const bytes = await getPrivateObjectBytes(
    authorized.imageKey,
    MAX_SLIDE_IMAGE_BYTES,
  );
  if (!bytes) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: privateImageHeaders(bytes.byteLength),
  });
}
