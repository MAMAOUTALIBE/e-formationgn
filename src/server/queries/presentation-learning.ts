import "server-only";

import { safeExternalPresentationUrl } from "@/lib/presentation-conversion-contract";
import { prisma } from "@/lib/prisma";

export interface LearnerPresentationHotspot {
  id: string;
  kind: "EXTERNAL_URL" | "INTERNAL_SLIDE";
  x: number;
  y: number;
  width: number;
  height: number;
  externalUrl: string | null;
  targetSlideOrder: number | null;
  ariaLabel: string | null;
}

export interface LearnerPresentationSlide {
  id: string;
  displayOrder: number;
  width: number;
  height: number;
  extractedText: string | null;
  hotspots: LearnerPresentationHotspot[];
}

export type LearnerPresentationState =
  | { status: "MISSING" | "UPLOADED" | "PROCESSING" | "ERROR" }
  | {
      status: "READY";
      slides: LearnerPresentationSlide[];
      progress: {
        lastSlideOrder: number;
        viewedSlideOrders: number[];
        completed: boolean;
      };
    };

const enrolledForLesson = (userId: string) => ({
  lesson: {
    section: {
      course: { enrollments: { some: { userId } } },
    },
  },
});

/**
 * DTO apprenant à sélection positive : aucune clé de stockage ni métadonnée
 * du fichier source ne peut traverser cette frontière serveur/client.
 */
export async function getLearnerPresentationState(
  userId: string,
  lessonId: string,
): Promise<LearnerPresentationState> {
  const ready = await prisma.presentation.findFirst({
    where: {
      lessonId,
      status: "READY",
      ...enrolledForLesson(userId),
    },
    select: {
      slides: {
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          displayOrder: true,
          width: true,
          height: true,
          extractedText: true,
          hotspots: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              kind: true,
              x: true,
              y: true,
              width: true,
              height: true,
              externalUrl: true,
              targetSlideOrder: true,
              ariaLabel: true,
            },
          },
        },
      },
      progress: {
        where: { userId },
        take: 1,
        select: {
          lastSlideOrder: true,
          viewedSlideOrders: true,
          completedAt: true,
        },
      },
    },
  });

  if (ready) {
    const progress = ready.progress[0];
    return {
      status: "READY",
      slides: ready.slides.map((slide) => ({
        ...slide,
        hotspots: slide.hotspots.flatMap((hotspot) => {
          if (hotspot.kind !== "EXTERNAL_URL") return [hotspot];
          const externalUrl = safeExternalPresentationUrl(hotspot.externalUrl);
          return externalUrl ? [{ ...hotspot, externalUrl }] : [];
        }),
      })),
      progress: {
        lastSlideOrder: progress?.lastSlideOrder ?? 0,
        viewedSlideOrders: progress?.viewedSlideOrders ?? [],
        completed: Boolean(progress?.completedAt),
      },
    };
  }

  const pending = await prisma.presentation.findFirst({
    where: { lessonId, status: { not: "READY" }, ...enrolledForLesson(userId) },
    select: { status: true },
  });
  if (
    pending?.status === "UPLOADED" ||
    pending?.status === "PROCESSING" ||
    pending?.status === "ERROR"
  ) {
    return { status: pending.status };
  }
  return { status: "MISSING" };
}
