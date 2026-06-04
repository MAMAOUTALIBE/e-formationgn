import "server-only";

// Données de la page d'accueil PERSONNALISÉE (utilisateur connecté) :
//   - cours en cours (reprendre l'apprentissage)
//   - recommandations card-ready (cours pertinents non possédés)

import { prisma } from "@/lib/prisma";

import {
  PUBLIC_COURSE_INCLUDE,
  serializeCourseListItem,
  type PublicCourseListItem,
} from "./courses";

export interface InProgressEnrollment {
  id: string;
  enrolledAt: Date;
  progressPercent: number;
  completedAt: Date | null;
  course: {
    slug: string;
    title: string;
    thumbnailUrl: string | null;
    instructor: {
      name: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  };
}

/** Cours commencés mais non terminés, le plus récemment suivi d'abord. */
export async function listInProgressEnrollments(
  userId: string,
  take = 4,
): Promise<InProgressEnrollment[]> {
  return prisma.enrollment.findMany({
    where: { userId, completedAt: null },
    orderBy: [
      { lastAccessedAt: { sort: "desc", nulls: "last" } },
      { enrolledAt: "desc" },
    ],
    take,
    select: {
      id: true,
      enrolledAt: true,
      progressPercent: true,
      completedAt: true,
      course: {
        select: {
          slug: true,
          title: true,
          thumbnailUrl: true,
          instructor: {
            select: { name: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });
}

/**
 * Recommandations simples : cours publiés que l'utilisateur ne possède pas,
 * en priorité dans les catégories qu'il suit déjà, sinon les plus populaires.
 * Renvoie des items prêts pour <CourseCard>.
 */
export async function listRecommendedCourseCards(
  userId: string,
  take = 8,
): Promise<PublicCourseListItem[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    select: { courseId: true, course: { select: { categoryId: true } } },
  });
  const ownedIds = enrollments.map((e) => e.courseId);
  const userCategoryIds = [
    ...new Set(enrollments.map((e) => e.course.categoryId)),
  ];

  const baseWhere = {
    status: "PUBLISHED" as const,
    id: { notIn: ownedIds.length > 0 ? ownedIds : ["__none__"] },
  };

  // 1. Dans les catégories de l'utilisateur.
  const inCategory =
    userCategoryIds.length > 0
      ? await prisma.course.findMany({
          where: { ...baseWhere, categoryId: { in: userCategoryIds } },
          include: PUBLIC_COURSE_INCLUDE,
          orderBy: [{ totalEnrollments: "desc" }, { averageRating: "desc" }],
          take,
        })
      : [];

  // 2. Compléter avec les plus populaires si besoin.
  let rows = inCategory;
  if (rows.length < take) {
    const excludeIds = [...ownedIds, ...rows.map((r) => r.id)];
    const fill = await prisma.course.findMany({
      where: {
        status: "PUBLISHED",
        id: { notIn: excludeIds.length > 0 ? excludeIds : ["__none__"] },
      },
      include: PUBLIC_COURSE_INCLUDE,
      orderBy: [{ totalEnrollments: "desc" }, { averageRating: "desc" }],
      take: take - rows.length,
    });
    rows = [...rows, ...fill];
  }

  return rows.map(serializeCourseListItem);
}
