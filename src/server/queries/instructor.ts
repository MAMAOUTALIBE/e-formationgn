// Queries serveur — espace formateur.
// Toutes les méthodes acceptent un `instructorId` et filtrent dessus, sauf
// les helpers admin (à venir en Phase 7).

import type { Prisma } from "@/generated/prisma/client";
import type { Currency } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const INSTRUCTOR_COURSE_INCLUDE = {
  category: { select: { id: true, slug: true, name: true } },
  // Sections + ids de leçons : nécessaires au calcul de readiness (% prêt).
  sections: { select: { lessons: { select: { id: true } } } },
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

// ---------------------------------------------------------------------------
// Readiness « prêt à publier » — source de vérité unique partagée par la
// checklist de l'éditeur, le badge % de la liste des cours, et la soumission
// à la modération (submitCourseForReview).
// ---------------------------------------------------------------------------

export interface ReadinessItem {
  key: string;
  label: string;
  done: boolean;
  /** true = bloquant pour la soumission ; false = recommandé. */
  required: boolean;
  /** Slug de l'étape de l'assistant où corriger ("" = Général). */
  stepSlug: string;
}

export interface CourseReadiness {
  items: ReadinessItem[];
  requiredDone: number;
  requiredTotal: number;
  /** % d'avancement sur les éléments OBLIGATOIRES (0–100). */
  percent: number;
  /** true quand tous les éléments obligatoires sont remplis. */
  ready: boolean;
  /** Libellés des éléments obligatoires manquants (pour les messages). */
  missingRequired: string[];
}

interface ReadinessInput {
  title: string;
  description: string;
  categoryId: string;
  thumbnailUrl: string | null;
  priceEUR: Prisma.Decimal | number;
  priceUSD: Prisma.Decimal | number;
  priceGNF: Prisma.Decimal | number;
  priceXOF: Prisma.Decimal | number;
  metaTitle: string | null;
  whatYouWillLearn: string[];
  sections: { lessons: { id: string }[] }[];
}

export function computeCourseReadiness(c: ReadinessInput): CourseReadiness {
  const priceOk = [c.priceEUR, c.priceUSD, c.priceGNF, c.priceXOF].some(
    (p) => Number(p) > 0,
  );

  const items: ReadinessItem[] = [
    {
      key: "title",
      label: "Titre renseigné",
      done: c.title.trim().length >= 5,
      required: true,
      stepSlug: "",
    },
    {
      key: "description",
      label: "Description (≥ 50 caractères)",
      done: c.description.trim().length >= 50,
      required: true,
      stepSlug: "",
    },
    {
      key: "category",
      label: "Catégorie choisie",
      done: c.categoryId.trim().length > 0,
      required: true,
      stepSlug: "",
    },
    {
      key: "thumbnail",
      label: "Image de couverture",
      done: Boolean(c.thumbnailUrl),
      required: true,
      stepSlug: "",
    },
    {
      key: "section",
      label: "Au moins une section",
      done: c.sections.length > 0,
      required: true,
      stepSlug: "programme",
    },
    {
      key: "lesson",
      label: "Au moins une leçon",
      done: c.sections.some((s) => s.lessons.length > 0),
      required: true,
      stepSlug: "programme",
    },
    {
      key: "price",
      label: "Prix défini (sinon gratuit)",
      done: priceOk,
      required: false,
      stepSlug: "tarification",
    },
    {
      key: "seo",
      label: "Méta-SEO ou objectifs pédagogiques",
      done: Boolean(c.metaTitle?.trim()) || c.whatYouWillLearn.length > 0,
      required: false,
      stepSlug: "seo",
    },
  ];

  const required = items.filter((i) => i.required);
  const requiredDone = required.filter((i) => i.done).length;
  const requiredTotal = required.length;
  const missingRequired = required.filter((i) => !i.done).map((i) => i.label);

  return {
    items,
    requiredDone,
    requiredTotal,
    percent: Math.round((requiredDone / requiredTotal) * 100),
    ready: requiredDone === requiredTotal,
    missingRequired,
  };
}

// ---------------------------------------------------------------------------
// Centre d'actions du tableau de bord : ce qui requiert l'attention du
// formateur (questions sans réponse, avis sans réponse, cours refusés).
// ---------------------------------------------------------------------------

export interface InstructorActionItems {
  unansweredQuestions: number;
  reviewsToReply: number;
  rejectedCourses: number;
}

export async function getInstructorActionItems(
  instructorId: string,
): Promise<InstructorActionItems> {
  const [unansweredQuestions, reviewsToReply, rejectedCourses] =
    await Promise.all([
      prisma.question.count({
        where: {
          course: { instructorId },
          isResolved: false,
          answers: { none: { userId: instructorId } },
        },
      }),
      prisma.review.count({
        where: { course: { instructorId }, instructorReply: null },
      }),
      prisma.course.count({
        where: { instructorId, status: "REJECTED" },
      }),
    ]);

  return { unansweredQuestions, reviewsToReply, rejectedCourses };
}

// ---------------------------------------------------------------------------
// Funnel d'un cours : vues de la fiche → inscriptions → cours terminés.
// ---------------------------------------------------------------------------

export interface CourseFunnel {
  views: number;
  enrollments: number;
  completions: number;
  /** Taux de complétion = completions / enrollments (0–100, arrondi). */
  completionRate: number;
  averageRating: number;
  totalRatings: number;
}

export async function getCourseFunnel(
  courseId: string,
  instructorId: string,
  isAdmin = false,
): Promise<CourseFunnel | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      slug: true,
      instructorId: true,
      averageRating: true,
      totalRatings: true,
    },
  });
  if (!course) return null;
  if (!isAdmin && course.instructorId !== instructorId) return null;

  const [views, enrollments, completions] = await Promise.all([
    prisma.pageView.count({ where: { path: `/cours/${course.slug}` } }),
    prisma.enrollment.count({ where: { courseId } }),
    prisma.enrollment.count({
      where: { courseId, completedAt: { not: null } },
    }),
  ]);

  return {
    views,
    enrollments,
    completions,
    completionRate:
      enrollments > 0 ? Math.round((completions / enrollments) * 100) : 0,
    averageRating: course.averageRating,
    totalRatings: course.totalRatings,
  };
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
  /** Ventes du mois civil précédent (pour le delta de tendance). */
  salesPrevMonthCount: number;
  /** Ventes par mois sur les 6 derniers mois (ancien → récent), pour sparkline. */
  salesSeries: Array<{ label: string; count: number }>;
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

  // 4) Série mensuelle des ventes sur 6 mois (counts, comparables entre devises).
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const seriesRows = await prisma.$queryRaw<
    Array<{ month: Date; cnt: bigint }>
  >`
    SELECT date_trunc('month', o."paidAt") AS month,
           COUNT(*)::bigint AS cnt
    FROM "OrderItem" oi
    INNER JOIN "Course" c ON c."id" = oi."courseId"
    INNER JOIN "Order"  o ON o."id" = oi."orderId"
    WHERE c."instructorId" = ${instructorId}
      AND o."status" = 'PAID'
      AND o."paidAt" >= ${sixMonthsAgo}
    GROUP BY 1
    ORDER BY 1
  `;

  const buckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("fr-FR", { month: "short" }),
      count: 0,
    };
  });
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const r of seriesRows) {
    const d = new Date(r.month);
    const bucket = byKey.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (bucket) bucket.count = Number(r.cnt);
  }
  const salesPrevMonthCount = buckets[buckets.length - 2]?.count ?? 0;

  return {
    payoutByCurrency,
    payoutThisMonthByCurrency,
    salesCount,
    salesThisMonthCount,
    salesPrevMonthCount,
    salesSeries: buckets.map((b) => ({ label: b.label, count: b.count })),
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

// ---------------------------------------------------------------------------
// Centre Q&A — agrégation des questions sur tous les cours du formateur.
// ---------------------------------------------------------------------------
export interface InstructorQuestionRow {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  isResolved: boolean;
  answersCount: number;
  hasInstructorAnswer: boolean;
  course: { id: string; slug: string; title: string };
  user: { id: string; name: string | null; image: string | null };
}

export async function listInstructorQuestions(
  instructorId: string,
  opts: { onlyUnanswered?: boolean; limit?: number } = {},
): Promise<InstructorQuestionRow[]> {
  const questions = await prisma.question.findMany({
    where: {
      course: { instructorId },
      ...(opts.onlyUnanswered
        ? {
            answers: { none: { userId: instructorId } },
          }
        : {}),
    },
    include: {
      course: { select: { id: true, slug: true, title: true } },
      user: { select: { id: true, name: true, image: true } },
      answers: { select: { userId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
  });
  return questions.map((q) => ({
    id: q.id,
    title: q.title,
    body: q.body,
    createdAt: q.createdAt,
    isResolved: q.isResolved,
    answersCount: q.answers.length,
    hasInstructorAnswer: q.answers.some((a) => a.userId === instructorId),
    course: q.course,
    user: q.user,
  }));
}

// ---------------------------------------------------------------------------
// Centre Avis — agrégation des reviews sur tous les cours du formateur,
// incluant la réponse formateur (instructorReply) si présente.
// ---------------------------------------------------------------------------
export interface InstructorReviewRow {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: Date;
  instructorReply: string | null;
  instructorRepliedAt: Date | null;
  course: { id: string; slug: string; title: string };
  user: { id: string; name: string | null; firstName: string | null; image: string | null };
}

export async function listInstructorReviews(
  instructorId: string,
  opts: { onlyUnanswered?: boolean; minRating?: number; limit?: number } = {},
): Promise<InstructorReviewRow[]> {
  const reviews = await prisma.review.findMany({
    where: {
      course: { instructorId },
      isPublished: true,
      ...(opts.minRating ? { rating: { gte: opts.minRating } } : {}),
      ...(opts.onlyUnanswered ? { instructorReply: null } : {}),
    },
    include: {
      course: { select: { id: true, slug: true, title: true } },
      user: {
        select: { id: true, name: true, firstName: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
  });
  return reviews;
}

// ---------------------------------------------------------------------------
// Annonces aux élèves — liste pour un cours donné (CRUD côté formateur).
// ---------------------------------------------------------------------------
export async function listCourseAnnouncements(
  courseId: string,
  instructorId: string,
) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { instructorId: true },
  });
  if (!course || course.instructorId !== instructorId) return null;
  return prisma.courseAnnouncement.findMany({
    where: { courseId },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true, firstName: true, image: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Engagement par leçon — dropoff = (% d'élèves qui ont vu cette leçon vs
// l'effectif total des inscrits du cours). Identifie où les élèves décrochent.
// ---------------------------------------------------------------------------
export interface LessonDropoffRow {
  lessonId: string;
  lessonTitle: string;
  sectionTitle: string;
  displayOrder: number;
  completedCount: number;
  startedCount: number;
}

export async function getLessonDropoff(
  courseId: string,
  instructorId: string,
): Promise<LessonDropoffRow[] | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { instructorId: true },
  });
  if (!course || course.instructorId !== instructorId) return null;

  const lessons = await prisma.lesson.findMany({
    where: { section: { courseId } },
    select: {
      id: true,
      title: true,
      displayOrder: true,
      section: { select: { title: true, displayOrder: true } },
      progress: {
        select: { isCompleted: true, watchedSeconds: true },
      },
    },
  });

  const rows: LessonDropoffRow[] = lessons.map((l) => ({
    lessonId: l.id,
    lessonTitle: l.title,
    sectionTitle: l.section.title,
    displayOrder: l.section.displayOrder * 1000 + l.displayOrder,
    completedCount: l.progress.filter((p) => p.isCompleted).length,
    startedCount: l.progress.filter((p) => p.watchedSeconds > 0).length,
  }));

  rows.sort((a, b) => a.displayOrder - b.displayOrder);
  return rows;
}

// ---------------------------------------------------------------------------
// Courbes daily enrollment + revenue d'un cours sur les 30 derniers jours.
// ---------------------------------------------------------------------------
export interface CourseTimeseriesPoint {
  date: string; // YYYY-MM-DD
  enrollments: number;
  revenueCents: number;
}

export async function getCourseTimeseries(
  courseId: string,
  instructorId: string,
  days = 30,
): Promise<CourseTimeseriesPoint[] | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { instructorId: true },
  });
  if (!course || course.instructorId !== instructorId) return null;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

  const [enrollments, orderItems] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId, enrolledAt: { gte: since } },
      select: { enrolledAt: true },
    }),
    prisma.orderItem.findMany({
      where: {
        courseId,
        order: { status: "PAID", paidAt: { gte: since } },
      },
      select: { instructorPayoutCents: true, order: { select: { paidAt: true } } },
    }),
  ]);

  // Bucket par jour
  const buckets = new Map<string, { enrollments: number; revenueCents: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
    buckets.set(d.toISOString().slice(0, 10), { enrollments: 0, revenueCents: 0 });
  }
  for (const e of enrollments) {
    const key = e.enrolledAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b) b.enrollments++;
  }
  for (const it of orderItems) {
    if (!it.order.paidAt) continue;
    const key = it.order.paidAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b) b.revenueCents += it.instructorPayoutCents;
  }
  return Array.from(buckets.entries()).map(([date, v]) => ({ date, ...v }));
}

