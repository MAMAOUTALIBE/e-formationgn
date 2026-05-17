// Queries serveur — espace formateur.
// Toutes les méthodes acceptent un `instructorId` et filtrent dessus, sauf
// les helpers admin (à venir en Phase 7).

import type { Prisma } from "@/generated/prisma/client";
import type { Currency } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const INSTRUCTOR_COURSE_INCLUDE = {
  category: { select: { id: true, slug: true, name: true } },
  _count: {
    select: {
      enrollments: true,
      reviews: true,
      sections: true,
    },
  },
} satisfies Prisma.CourseInclude;

export type InstructorCourseListItem = Prisma.CourseGetPayload<{
  include: typeof INSTRUCTOR_COURSE_INCLUDE;
}>;

export async function listInstructorCourses(
  instructorId: string,
): Promise<InstructorCourseListItem[]> {
  const courses = await prisma.course.findMany({
    where: { instructorId },
    include: INSTRUCTOR_COURSE_INCLUDE,
    orderBy: [{ updatedAt: "desc" }],
  });
  return courses as InstructorCourseListItem[];
}

const INSTRUCTOR_COURSE_DETAIL_INCLUDE = {
  category: { select: { id: true, slug: true, name: true } },
  sections: {
    orderBy: { displayOrder: "asc" },
    include: {
      lessons: {
        orderBy: { displayOrder: "asc" },
      },
    },
  },
  _count: { select: { enrollments: true, reviews: true } },
} satisfies Prisma.CourseInclude;

export type InstructorCourseDetail = Prisma.CourseGetPayload<{
  include: typeof INSTRUCTOR_COURSE_DETAIL_INCLUDE;
}>;

export async function getInstructorCourse(
  courseId: string,
  instructorId: string,
  isAdmin = false,
): Promise<InstructorCourseDetail | null> {
  // internalNotes : champ admin-only (notes privées de modération). On l'omet
  // côté query si le viewer n'est pas admin, plutôt que de le set à null
  // post-fetch — défense en profondeur, le champ ne quitte jamais la base
  // pour un formateur propriétaire.
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: INSTRUCTOR_COURSE_DETAIL_INCLUDE,
    omit: isAdmin ? undefined : { internalNotes: true },
  });
  if (!course) return null;
  if (!isAdmin && course.instructorId !== instructorId) return null;

  return course as InstructorCourseDetail;
}

export interface InstructorDashboardStats {
  totalCourses: number;
  publishedCourses: number;
  pendingReviewCourses: number;
  draftCourses: number;
  totalEnrollments: number;
  averageRating: number | null;
  totalReviews: number;
}

export async function getInstructorDashboardStats(
  instructorId: string,
): Promise<InstructorDashboardStats> {
  const [byStatus, ratingStats] = await Promise.all([
    prisma.course.groupBy({
      by: ["status"],
      where: { instructorId },
      _count: { _all: true },
      _sum: { totalEnrollments: true, totalRatings: true },
    }),
    prisma.course.aggregate({
      where: { instructorId, status: "PUBLISHED", totalRatings: { gt: 0 } },
      _avg: { averageRating: true },
      _sum: { totalRatings: true },
    }),
  ]);

  const stats: InstructorDashboardStats = {
    totalCourses: 0,
    publishedCourses: 0,
    pendingReviewCourses: 0,
    draftCourses: 0,
    totalEnrollments: 0,
    averageRating: ratingStats._avg.averageRating ?? null,
    totalReviews: ratingStats._sum.totalRatings ?? 0,
  };

  for (const group of byStatus) {
    stats.totalCourses += group._count._all;
    stats.totalEnrollments += group._sum.totalEnrollments ?? 0;
    if (group.status === "PUBLISHED") stats.publishedCourses = group._count._all;
    if (group.status === "PENDING_REVIEW") stats.pendingReviewCourses = group._count._all;
    if (group.status === "DRAFT") stats.draftCourses = group._count._all;
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Analytics revenue formateur — Sprint Conversion+
// ---------------------------------------------------------------------------
//
// Toutes les agrégations sont faites en SQL (GROUP BY + SUM) plutôt qu'en
// chargeant tous les OrderItem en mémoire. Garde le payload constant même
// avec un gros catalogue.

export interface InstructorRevenueOverview {
  /** Revenu net (instructorPayoutCents) du formateur, par devise. */
  payoutByCurrency: Record<Currency, number>;
  /** Revenu net du mois courant, par devise. */
  payoutThisMonthByCurrency: Record<Currency, number>;
  /** Nombre total de ventes (OrderItem) all-time. */
  salesCount: number;
  /** Ventes du mois courant. */
  salesThisMonthCount: number;
  /** Cours le plus vendu (revenue net) avec compteurs. */
  topCourses: Array<{
    courseId: string;
    title: string;
    slug: string;
    payoutCents: number;
    currency: Currency;
    salesCount: number;
  }>;
}

export async function getInstructorRevenueOverview(
  instructorId: string,
): Promise<InstructorRevenueOverview> {
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  );

  // 1) Revenu total par devise (all-time) + count des ventes (en 1 query SQL)
  const allTimeRows = await prisma.$queryRaw<
    Array<{ currency: Currency; payout: bigint; salesCount: bigint }>
  >`
    SELECT oi."currency" AS currency,
           COALESCE(SUM(oi."instructorPayoutCents"), 0)::bigint AS payout,
           COUNT(*)::bigint AS "salesCount"
    FROM "OrderItem" oi
    INNER JOIN "Course" c ON c."id" = oi."courseId"
    INNER JOIN "Order"  o ON o."id" = oi."orderId"
    WHERE c."instructorId" = ${instructorId}
      AND o."status" = 'PAID'
    GROUP BY oi."currency"
  `;

  const payoutByCurrency: Record<Currency, number> = {
    EUR: 0,
    USD: 0,
    GNF: 0,
    XOF: 0,
  };
  let salesCount = 0;
  for (const r of allTimeRows) {
    payoutByCurrency[r.currency] = Number(r.payout);
    salesCount += Number(r.salesCount);
  }

  // 2) Revenu mois courant par devise + count
  const monthRows = await prisma.$queryRaw<
    Array<{ currency: Currency; payout: bigint; salesCount: bigint }>
  >`
    SELECT oi."currency" AS currency,
           COALESCE(SUM(oi."instructorPayoutCents"), 0)::bigint AS payout,
           COUNT(*)::bigint AS "salesCount"
    FROM "OrderItem" oi
    INNER JOIN "Course" c ON c."id" = oi."courseId"
    INNER JOIN "Order"  o ON o."id" = oi."orderId"
    WHERE c."instructorId" = ${instructorId}
      AND o."status" = 'PAID'
      AND o."paidAt" >= ${startOfMonth}
    GROUP BY oi."currency"
  `;

  const payoutThisMonthByCurrency: Record<Currency, number> = {
    EUR: 0,
    USD: 0,
    GNF: 0,
    XOF: 0,
  };
  let salesThisMonthCount = 0;
  for (const r of monthRows) {
    payoutThisMonthByCurrency[r.currency] = Number(r.payout);
    salesThisMonthCount += Number(r.salesCount);
  }

  // 3) Top 5 cours par revenu — GROUP BY courseId + ORDER BY SUM DESC.
  // On ne prend que la devise dominante du cours pour simplifier (un même
  // cours peut être vendu en plusieurs devises mais on agrège par max).
  const topRows = await prisma.$queryRaw<
    Array<{
      courseId: string;
      title: string;
      slug: string;
      payout: bigint;
      currency: Currency;
      salesCount: bigint;
    }>
  >`
    SELECT c."id"                                        AS "courseId",
           c."title"                                     AS title,
           c."slug"                                      AS slug,
           SUM(oi."instructorPayoutCents")::bigint       AS payout,
           MIN(oi."currency"::text)::"Currency"          AS currency,
           COUNT(*)::bigint                              AS "salesCount"
    FROM "OrderItem" oi
    INNER JOIN "Course" c ON c."id" = oi."courseId"
    INNER JOIN "Order"  o ON o."id" = oi."orderId"
    WHERE c."instructorId" = ${instructorId}
      AND o."status" = 'PAID'
    GROUP BY c."id", c."title", c."slug"
    ORDER BY payout DESC
    LIMIT 5
  `;

  return {
    payoutByCurrency,
    payoutThisMonthByCurrency,
    salesCount,
    salesThisMonthCount,
    topCourses: topRows.map((r) => ({
      courseId: r.courseId,
      title: r.title,
      slug: r.slug,
      payoutCents: Number(r.payout),
      currency: r.currency,
      salesCount: Number(r.salesCount),
    })),
  };
}

export async function getLessonForInstructor(
  lessonId: string,
  instructorId: string,
  isAdmin = false,
) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      section: {
        include: { course: { select: { id: true, instructorId: true, slug: true } } },
      },
    },
  });
  if (!lesson) return null;
  if (!isAdmin && lesson.section.course.instructorId !== instructorId) return null;
  return lesson;
}
