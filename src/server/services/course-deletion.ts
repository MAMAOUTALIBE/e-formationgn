import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { CourseDeletionMedia, CourseDeletionOutcome } from "@/lib/domain/course-deletion";
import { prisma } from "@/lib/prisma";

export async function deleteCourseRecordIfUnused(courseId: string): Promise<CourseDeletionOutcome> {
  try {
    return await prisma.$transaction(async (tx) => {
      const course = await tx.course.findUnique({
        where: { id: courseId },
        select: {
          title: true,
          instructorId: true,
          thumbnailUrl: true,
          heroBackgroundUrl: true,
          promoVideoMuxId: true,
          _count: { select: { orderItems: true, enrollments: true, certificates: true, programs: true } },
          sections: { select: { lessons: { select: {
            muxAssetId: true,
            externalVideoUrl: true,
            resourceUrl: true,
            resources: { select: { url: true } },
            presentation: {
              select: {
                id: true,
                sourceKey: true,
                processingToken: true,
                slides: { select: { imageKey: true } },
              },
            },
          } } } },
        },
      });
      if (!course) return { kind: "missing" as const };
      const counts = course._count;
      if (counts.orderItems || counts.enrollments || counts.certificates || counts.programs) {
        return { kind: "blocked" as const };
      }

      const lessons = course.sections.flatMap((section) => section.lessons);
      const media: CourseDeletionMedia = {
        ownerId: course.instructorId,
        muxAssetIds: [course.promoVideoMuxId, ...lessons.map((lesson) => lesson.muxAssetId)].filter((id): id is string => Boolean(id)),
        storedUrls: [
          course.thumbnailUrl,
          course.heroBackgroundUrl,
          ...lessons.flatMap((lesson) => [
            lesson.externalVideoUrl,
            lesson.resourceUrl,
            ...lesson.resources.map((resource) => resource.url),
          ]),
        ].filter((url): url is string => Boolean(url)),
        privateKeys: lessons.flatMap((lesson) => [
          ...(lesson.presentation ? [lesson.presentation.sourceKey] : []),
          ...(lesson.presentation?.slides.map((slide) => slide.imageKey) ?? []),
        ]),
        privatePrefixes: lessons.flatMap((lesson) =>
          lesson.presentation?.processingToken
            ? [
                `presentations/rendered/${lesson.presentation.id}/${lesson.presentation.processingToken}`,
              ]
            : [],
        ),
      };
      await tx.course.delete({ where: { id: courseId } });
      return { kind: "deleted" as const, title: course.title, media };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return { kind: "blocked" };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return { kind: "concurrent" };
    throw error;
  }
}
