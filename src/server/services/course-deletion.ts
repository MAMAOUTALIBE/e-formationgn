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
          promoVideoMuxId: true,
          _count: { select: { orderItems: true, enrollments: true, certificates: true, programs: true } },
          sections: { select: { lessons: { select: {
            muxAssetId: true,
            externalVideoUrl: true,
            resourceUrl: true,
            resources: { select: { url: true } },
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
          ...lessons.flatMap((lesson) => [
            lesson.externalVideoUrl,
            lesson.resourceUrl,
            ...lesson.resources.map((resource) => resource.url),
          ]),
        ].filter((url): url is string => Boolean(url)),
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
