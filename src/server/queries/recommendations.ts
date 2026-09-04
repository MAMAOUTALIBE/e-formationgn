import "server-only";

// Recommandations de cours personnalisées pour l'élève.
//
// Stratégie hybride pure-SQL (rapide, prédictible, gratuit) :
//   1. Boost si même catégorie qu'un cours déjà inscrit
//   2. Boost si même catégorie qu'un cours en wishlist
//   3. Filtre les cours déjà possédés ou en panier
//   4. Tri par popularité + note (totalEnrollments DESC, averageRating DESC)
//
// Pas d'appel IA pour la V1 — on peut ajouter une couche Groq pour générer
// l'explication "pourquoi ce cours" en post-traitement plus tard.

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const RECO_INCLUDE = {
  instructor: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      headline: true,
      image: true,
    },
  },
  category: { select: { id: true, slug: true, name: true } },
  _count: { select: { enrollments: true, reviews: true } },
} satisfies Prisma.CourseInclude;

export type RecommendedCourse = Prisma.CourseGetPayload<{
  include: typeof RECO_INCLUDE;
}> & {
  /** Raison concise affichable (UX). Ex: "Dans votre domaine". */
  reason: string;
};

interface RecoOptions {
  userId: string;
  limit?: number;
}

/**
 * Renvoie une liste de cours pertinents pour l'utilisateur, avec une raison
 * lisible côté UI. Garantit qu'aucun cours déjà inscrit/en panier n'apparaît.
 */
export async function getRecommendedCourses({
  userId,
  limit = 6,
}: RecoOptions): Promise<RecommendedCourse[]> {
  // 1. Récupère les signaux de l'utilisateur (catégories déjà engagées)
  const [enrollments, wishlist, cartItems] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId },
      select: { courseId: true, course: { select: { categoryId: true } } },
    }),
    prisma.wishlistItem.findMany({
      where: { userId },
      select: { courseId: true, course: { select: { categoryId: true } } },
    }),
    prisma.cartItem.findMany({
      where: { userId },
      select: { courseId: true },
    }),
  ]);

  const ownedIds = new Set([
    ...enrollments.map((e) => e.courseId),
    ...cartItems.map((c) => c.courseId),
  ]);
  const interestedCategoryIds = new Set<string>([
    ...enrollments.map((e) => e.course.categoryId),
    ...wishlist.map((w) => w.course.categoryId),
  ]);
  const wishlistIds = new Set(wishlist.map((w) => w.courseId));

  // 2. Si on a des signaux : recommander dans les mêmes catégories
  //    Sinon : fallback sur les top cours globaux (cold start)
  const baseWhere: Prisma.CourseWhereInput = {
    status: "PUBLISHED",
    id: { notIn: Array.from(ownedIds) },
  };

  let candidates: Array<
    Prisma.CourseGetPayload<{ include: typeof RECO_INCLUDE }>
  >;

  if (interestedCategoryIds.size > 0) {
    // Cours dans les mêmes catégories, triés par popularité × note
    candidates = await prisma.course.findMany({
      where: {
        ...baseWhere,
        categoryId: { in: Array.from(interestedCategoryIds) },
      },
      include: RECO_INCLUDE,
      orderBy: [
        { totalEnrollments: "desc" },
        { averageRating: "desc" },
        { publishedAt: "desc" },
      ],
      // On prend un peu plus que limit pour pouvoir mixer avec wishlist
      take: limit * 2,
    });
  } else {
    // Cold start : top global
    candidates = await prisma.course.findMany({
      where: baseWhere,
      include: RECO_INCLUDE,
      orderBy: [
        { totalEnrollments: "desc" },
        { averageRating: "desc" },
      ],
      take: limit,
    });
  }

  // 3. Tag avec une raison lisible et déduplique
  const seen = new Set<string>();
  const result: RecommendedCourse[] = [];
  for (const course of candidates) {
    if (seen.has(course.id)) continue;
    seen.add(course.id);

    let reason = "Populaire chez les élèves";
    if (wishlistIds.has(course.id)) {
      reason = "Dans votre liste de souhaits";
    } else if (interestedCategoryIds.has(course.categoryId)) {
      reason = "Dans votre domaine";
    }

    result.push({ ...course, reason });
    if (result.length >= limit) break;
  }

  return result;
}
