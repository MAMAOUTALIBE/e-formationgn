import "server-only";

import { Prisma } from "@/generated/prisma/client";
import {
  isPresentationComplete,
  mergeViewedSlideOrders,
} from "@/lib/presentation-learning";
import { prisma } from "@/lib/prisma";
import { markLessonCompleted } from "@/server/services/lesson-completion";

export class PresentationLearningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PresentationLearningError";
  }
}

export interface PresentationViewResult {
  lastSlideOrder: number;
  viewedSlideOrders: number[];
  completed: boolean;
  progressPercent?: number;
}

export async function recordPresentationSlideViewForUser(input: {
  userId: string;
  lessonId: string;
  slideId: string;
}): Promise<PresentationViewResult> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // La relation et l'ordre viennent exclusivement de la base. Le client
          // ne peut donc ni inventer un ordre ni visiter une slide d'une autre leçon.
          const presentation = await tx.presentation.findFirst({
            where: {
              lessonId: input.lessonId,
              status: "READY",
              slides: { some: { id: input.slideId } },
            },
            select: {
              id: true,
              lesson: { select: { section: { select: { courseId: true } } } },
              slides: {
                orderBy: { displayOrder: "asc" },
                select: { id: true, displayOrder: true },
              },
            },
          });
          if (!presentation || presentation.slides.length === 0) {
            throw new PresentationLearningError("Présentation indisponible.");
          }

          const courseId = presentation.lesson.section.courseId;
          const enrollment = await tx.enrollment.findUnique({
            where: { userId_courseId: { userId: input.userId, courseId } },
            select: { id: true },
          });
          if (!enrollment) {
            throw new PresentationLearningError("Présentation indisponible.");
          }

          const actualSlide = presentation.slides.find(
            (slide) => slide.id === input.slideId,
          );
          if (!actualSlide) {
            throw new PresentationLearningError("Présentation indisponible.");
          }

          const existing = await tx.presentationProgress.findUnique({
            where: {
              presentationId_userId: {
                presentationId: presentation.id,
                userId: input.userId,
              },
            },
            select: { viewedSlideOrders: true, completedAt: true },
          });
          const viewedSlideOrders = mergeViewedSlideOrders(
            existing?.viewedSlideOrders ?? [],
            actualSlide.displayOrder,
          );
          const newlyCompleted = isPresentationComplete({
            viewedSlideOrders,
            slideOrders: presentation.slides.map((slide) => slide.displayOrder),
            currentSlideOrder: actualSlide.displayOrder,
          });
          const completed = Boolean(existing?.completedAt) || newlyCompleted;
          const now = new Date();

          await tx.presentationProgress.upsert({
            where: {
              presentationId_userId: {
                presentationId: presentation.id,
                userId: input.userId,
              },
            },
            update: {
              lastSlideOrder: actualSlide.displayOrder,
              viewedSlideOrders,
              lastViewedAt: now,
              completedAt: newlyCompleted ? existing?.completedAt ?? now : undefined,
            },
            create: {
              presentationId: presentation.id,
              userId: input.userId,
              lastSlideOrder: actualSlide.displayOrder,
              viewedSlideOrders,
              lastViewedAt: now,
              completedAt: newlyCompleted ? now : null,
            },
          });

          let progressPercent: number | undefined;
          if (newlyCompleted) {
            const lessonProgress = await markLessonCompleted(
              { userId: input.userId, lessonId: input.lessonId, courseId },
              tx,
            );
            progressPercent = lessonProgress.progressPercent;
          } else {
            await tx.enrollment.update({
              where: { id: enrollment.id },
              data: { lastAccessedAt: now },
            });
          }

          return {
            lastSlideOrder: actualSlide.displayOrder,
            viewedSlideOrders,
            completed,
            progressPercent,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!retryable || attempt >= 2) throw error;
    }
  }
}
