// Requêtes pour la vue d'ensemble du CRM admin (/admin).
// Toutes paramétrées par une période (from/to). Les SUM monétaires sont
// regroupées par devise puisqu'on ne convertit jamais EUR ↔ USD.

import type { Currency } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export interface AdminOverviewKpis {
  revenueByCurrency: Record<Currency, number>; // en cents
  revenuePreviousByCurrency: Record<Currency, number>;
  ordersCount: number;
  newSignups: number;
  newCourses: number;
  averageCompletionPercent: number;
  pendingCoursesCount: number;
  activeStudents30d: number;
}

interface PeriodRange {
  from: Date;
  to: Date;
}

export interface CrmDashboardSnapshot {
  registrationsCount: number;
  plannedSessions: number;
  activePrograms: number;
  pendingRegistrations: number;
  registrationRatePercent: number;
  previousRegistrationRatePercent: number;
  upcomingSessions: Array<{
    id: string;
    title: string;
    reference: string | null;
    startDate: Date;
    location: string | null;
    capacity: number | null;
    registrationsCount: number;
  }>;
  recentRegistrations: Array<{
    id: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
    programTitle: string;
    sessionReference: string | null;
    status: "PENDING" | "ACTIVE" | "SUSPENDED" | "COMPLETED" | "CANCELLED";
    registeredAt: Date;
  }>;
}

/** Données CRM propres au centre de formation, sans valeur de démonstration. */
export async function getCrmDashboardSnapshot(
  range: PeriodRange,
): Promise<CrmDashboardSnapshot> {
  const periodLength = range.to.getTime() - range.from.getTime();
  const previousFrom = new Date(range.from.getTime() - periodLength);
  const now = new Date();

  const [
    plannedSessions,
    activePrograms,
    pendingRegistrations,
    currentRegistrations,
    previousRegistrations,
    currentCapacity,
    previousCapacity,
    upcomingSessions,
    recentRegistrations,
  ] = await Promise.all([
    prisma.trainingSession.count({
      where: { status: "PLANNED", startDate: { gte: now } },
    }),
    prisma.program.count({ where: { status: "ACTIVE" } }),
    prisma.registration.count({ where: { status: "PENDING" } }),
    prisma.registration.count({
      where: { registeredAt: { gte: range.from, lte: range.to } },
    }),
    prisma.registration.count({
      where: { registeredAt: { gte: previousFrom, lt: range.from } },
    }),
    prisma.trainingSession.aggregate({
      _sum: { capacity: true },
      where: { startDate: { gte: range.from, lte: range.to }, status: { not: "CANCELLED" } },
    }),
    prisma.trainingSession.aggregate({
      _sum: { capacity: true },
      where: { startDate: { gte: previousFrom, lt: range.from }, status: { not: "CANCELLED" } },
    }),
    prisma.trainingSession.findMany({
      where: { startDate: { gte: now }, status: "PLANNED" },
      orderBy: { startDate: "asc" },
      take: 4,
      select: {
        id: true,
        reference: true,
        startDate: true,
        location: true,
        capacity: true,
        program: { select: { title: true } },
        _count: { select: { registrations: true } },
      },
    }),
    prisma.registration.findMany({
      orderBy: { registeredAt: "desc" },
      take: 5,
      select: {
        id: true,
        studentId: true,
        status: true,
        registeredAt: true,
        student: { select: { name: true, firstName: true, lastName: true, email: true } },
        session: {
          select: {
            reference: true,
            program: { select: { title: true } },
          },
        },
      },
    }),
  ]);

  const rate = (registrations: number, capacity: number | null | undefined) =>
    capacity && capacity > 0 ? Math.round((registrations / capacity) * 1000) / 10 : 0;

  return {
    registrationsCount: currentRegistrations,
    plannedSessions,
    activePrograms,
    pendingRegistrations,
    registrationRatePercent: rate(currentRegistrations, currentCapacity._sum.capacity),
    previousRegistrationRatePercent: rate(previousRegistrations, previousCapacity._sum.capacity),
    upcomingSessions: upcomingSessions.map((session) => ({
      id: session.id,
      title: session.program.title,
      reference: session.reference,
      startDate: session.startDate,
      location: session.location,
      capacity: session.capacity,
      registrationsCount: session._count.registrations,
    })),
    recentRegistrations: recentRegistrations.map((registration) => ({
      id: registration.id,
      studentId: registration.studentId,
      studentName:
        registration.student.name ??
        ([registration.student.firstName, registration.student.lastName].filter(Boolean).join(" ") ||
          registration.student.email),
      studentEmail: registration.student.email,
      programTitle: registration.session.program.title,
      sessionReference: registration.session.reference,
      status: registration.status,
      registeredAt: registration.registeredAt,
    })),
  };
}

export async function getAdminOverviewKpis(
  range: PeriodRange,
): Promise<AdminOverviewKpis> {
  const length = range.to.getTime() - range.from.getTime();
  const previousFrom = new Date(range.from.getTime() - length);
  const previousTo = new Date(range.from);

  const [
    revenueAgg,
    revenuePrev,
    ordersCount,
    newSignups,
    newCourses,
    completionAgg,
    pendingCourses,
    activeStudents,
  ] = await Promise.all([
    prisma.order.groupBy({
      by: ["currency"],
      where: { status: "PAID", paidAt: { gte: range.from, lte: range.to } },
      _sum: { totalCents: true },
    }),
    prisma.order.groupBy({
      by: ["currency"],
      where: { status: "PAID", paidAt: { gte: previousFrom, lte: previousTo } },
      _sum: { totalCents: true },
    }),
    prisma.order.count({
      where: { status: "PAID", paidAt: { gte: range.from, lte: range.to } },
    }),
    prisma.user.count({
      where: { createdAt: { gte: range.from, lte: range.to } },
    }),
    prisma.course.count({
      where: { publishedAt: { gte: range.from, lte: range.to } },
    }),
    prisma.enrollment.aggregate({
      _avg: { progressPercent: true },
      where: { enrolledAt: { gte: range.from, lte: range.to } },
    }),
    prisma.course.count({ where: { status: "PENDING_REVIEW" } }),
    // COUNT(DISTINCT) en SQL pur : évite de matérialiser tous les userIds
    // (un findMany distinct charge N lignes, même pour juste compter).
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM "LessonProgress"
      WHERE "updatedAt" >= ${new Date(Date.now() - 30 * 24 * 3600 * 1000)}
    `,
  ]);

  const revenueByCurrency: Record<Currency, number> = { EUR: 0, USD: 0, GNF: 0, XOF: 0 };
  for (const r of revenueAgg) {
    revenueByCurrency[r.currency] = r._sum.totalCents ?? 0;
  }
  const revenuePreviousByCurrency: Record<Currency, number> = { EUR: 0, USD: 0, GNF: 0, XOF: 0 };
  for (const r of revenuePrev) {
    revenuePreviousByCurrency[r.currency] = r._sum.totalCents ?? 0;
  }

  return {
    revenueByCurrency,
    revenuePreviousByCurrency,
    ordersCount,
    newSignups,
    newCourses,
    averageCompletionPercent: Math.round(
      (completionAgg._avg.progressPercent ?? 0) * 10,
    ) / 10,
    pendingCoursesCount: pendingCourses,
    activeStudents30d: Number(activeStudents[0]?.count ?? 0),
  };
}

export interface RevenuePoint {
  date: string; // YYYY-MM-DD
  EUR: number; // cents
  USD: number;
}

export async function getRevenueTimeseries(
  range: PeriodRange,
): Promise<RevenuePoint[]> {
  const orders = await prisma.order.findMany({
    where: { status: "PAID", paidAt: { gte: range.from, lte: range.to } },
    select: { paidAt: true, currency: true, totalCents: true },
  });

  const buckets = new Map<
    string,
    { EUR: number; USD: number; GNF: number; XOF: number }
  >();
  // Initialise toutes les dates de la plage à 0 pour un graphe sans trous.
  for (
    let d = new Date(range.from);
    d <= range.to;
    d.setDate(d.getDate() + 1)
  ) {
    buckets.set(toIsoDate(d), { EUR: 0, USD: 0, GNF: 0, XOF: 0 });
  }
  for (const o of orders) {
    if (!o.paidAt) continue;
    const key = toIsoDate(o.paidAt);
    const bucket = buckets.get(key) ?? { EUR: 0, USD: 0, GNF: 0, XOF: 0 };
    bucket[o.currency] += o.totalCents;
    buckets.set(key, bucket);
  }
  return Array.from(buckets.entries()).map(([date, v]) => ({
    date,
    EUR: v.EUR,
    USD: v.USD,
    GNF: v.GNF,
    XOF: v.XOF,
  }));
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface TopCourseRow {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  revenueCents: number;
  ordersCount: number;
  currency: Currency;
}

export async function getTopCoursesByRevenue(
  range: PeriodRange,
  limit = 5,
): Promise<TopCourseRow[]> {
  // GroupBy sur OrderItem joint avec Course. On agrège en EUR par défaut
  // (les meilleures plateformes de stats convertissent — ici on présente brut).
  const items = await prisma.orderItem.groupBy({
    by: ["courseId", "currency"],
    where: {
      order: { status: "PAID", paidAt: { gte: range.from, lte: range.to } },
    },
    _sum: { totalCents: true },
    _count: { _all: true },
    orderBy: { _sum: { totalCents: "desc" } },
    take: limit * 2, // surrécolte au cas où multi-devise
  });

  const courseIds = Array.from(new Set(items.map((i) => i.courseId)));
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: { id: true, title: true, thumbnailUrl: true },
  });
  const courseMap = new Map(courses.map((c) => [c.id, c]));

  return items.slice(0, limit).map((i) => {
    const c = courseMap.get(i.courseId);
    return {
      id: i.courseId,
      title: c?.title ?? "(formation supprimée)",
      thumbnailUrl: c?.thumbnailUrl ?? null,
      revenueCents: i._sum.totalCents ?? 0,
      ordersCount: i._count._all,
      currency: i.currency,
    };
  });
}

export interface TopInstructorRow {
  id: string;
  name: string;
  email: string;
  payoutCents: number;
  platformFeeCents: number;
  currency: Currency;
}

export async function getTopInstructorsByRevenue(
  range: PeriodRange,
  limit = 5,
): Promise<TopInstructorRow[]> {
  // Agrégation côté DB (GROUP BY + ORDER BY + LIMIT) plutôt que findMany
  // exhaustif + reduce JS : O(N) lignes au lieu de O(orderItems).
  const rows = await prisma.$queryRaw<
    Array<{
      instructorId: string;
      payout: bigint;
      fee: bigint;
      currency: Currency;
    }>
  >`
    SELECT c."instructorId"               AS "instructorId",
           SUM(oi."instructorPayoutCents")::bigint AS "payout",
           SUM(oi."platformFeeCents")::bigint     AS "fee",
           MIN(oi."currency"::text)::"Currency"   AS "currency"
    FROM "OrderItem" oi
    INNER JOIN "Course" c ON c."id" = oi."courseId"
    INNER JOIN "Order"  o ON o."id" = oi."orderId"
    WHERE o."status" = 'PAID'
      AND o."paidAt" >= ${range.from}
      AND o."paidAt" <= ${range.to}
    GROUP BY c."instructorId"
    ORDER BY "payout" DESC
    LIMIT ${limit}
  `;

  const ids = rows.map((r) => r.instructorId);
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true, firstName: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return rows.map((r) => {
    const u = userMap.get(r.instructorId);
    return {
      id: r.instructorId,
      name: u?.name ?? u?.firstName ?? "(supprimé)",
      email: u?.email ?? "",
      payoutCents: Number(r.payout),
      platformFeeCents: Number(r.fee),
      currency: r.currency,
    };
  });
}

export interface CategoryRevenueSlice {
  categoryId: string;
  categoryName: string;
  revenueCents: number;
}

export async function getRevenueByCategory(
  range: PeriodRange,
): Promise<CategoryRevenueSlice[]> {
  // Agrégation côté DB (GROUP BY catégorie + ORDER BY revenue).
  const rows = await prisma.$queryRaw<
    Array<{ categoryId: string; revenue: bigint }>
  >`
    SELECT c."categoryId"          AS "categoryId",
           SUM(oi."totalCents")::bigint AS "revenue"
    FROM "OrderItem" oi
    INNER JOIN "Course" c ON c."id" = oi."courseId"
    INNER JOIN "Order"  o ON o."id" = oi."orderId"
    WHERE o."status" = 'PAID'
      AND o."paidAt" >= ${range.from}
      AND o."paidAt" <= ${range.to}
    GROUP BY c."categoryId"
    ORDER BY "revenue" DESC
  `;
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.categoryId);
  const cats = await prisma.category.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: catMap.get(r.categoryId) ?? "(supprimée)",
    revenueCents: Number(r.revenue),
  }));
}

export interface AdminAlert {
  kind: "pending-courses" | "open-disputes" | "stripe-missing" | "failed-payments" | "pending-reports";
  count: number;
  href: string;
  label: string;
}

export async function getAdminAlerts(): Promise<AdminAlert[]> {
  const last24h = new Date(Date.now() - 24 * 3600 * 1000);
  const [pendingCourses, openDisputes, stripeMissing, failedPayments, pendingReports] =
    await Promise.all([
      prisma.course.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.dispute.count({
        where: { status: { in: ["OPEN", "IN_REVIEW"] } },
      }),
      prisma.user.count({
        where: { isInstructor: true, stripeOnboardingDone: false },
      }),
      prisma.order.count({
        where: { status: "FAILED", updatedAt: { gte: last24h } },
      }),
      prisma.report.count({ where: { status: "PENDING" } }),
    ]);

  const alerts: AdminAlert[] = [];
  if (pendingCourses > 0)
    alerts.push({
      kind: "pending-courses",
      count: pendingCourses,
      href: "/admin/cours?status=PENDING_REVIEW",
      label: `${pendingCourses} formation${pendingCourses > 1 ? "s" : ""} en attente de modération`,
    });
  if (openDisputes > 0)
    alerts.push({
      kind: "open-disputes",
      count: openDisputes,
      href: "/admin/support/litiges",
      label: `${openDisputes} litige${openDisputes > 1 ? "s" : ""} ouvert${openDisputes > 1 ? "s" : ""}`,
    });
  if (stripeMissing > 0)
    alerts.push({
      kind: "stripe-missing",
      count: stripeMissing,
      href: "/admin/formateurs?stripe=missing",
      label: `${stripeMissing} formateur${stripeMissing > 1 ? "s" : ""} sans Stripe Connect`,
    });
  if (failedPayments > 0)
    alerts.push({
      kind: "failed-payments",
      count: failedPayments,
      href: "/admin/finances/transactions?status=FAILED",
      label: `${failedPayments} paiement${failedPayments > 1 ? "s" : ""} échoué${failedPayments > 1 ? "s" : ""} (24 h)`,
    });
  if (pendingReports > 0)
    alerts.push({
      kind: "pending-reports",
      count: pendingReports,
      href: "/admin/moderation/signalements",
      label: `${pendingReports} signalement${pendingReports > 1 ? "s" : ""} en attente`,
    });
  return alerts;
}

export interface ActivityItem {
  id: string;
  kind: "signup" | "order" | "course-published" | "audit";
  title: string;
  subtitle?: string;
  href?: string;
  createdAt: Date;
}

export async function getRecentActivity(limit = 20): Promise<ActivityItem[]> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [signups, orders, publications, audit] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, email: true, name: true, createdAt: true, role: true },
    }),
    prisma.order.findMany({
      where: { status: "PAID", paidAt: { gte: since } },
      orderBy: { paidAt: "desc" },
      take: limit,
      select: {
        id: true,
        totalCents: true,
        currency: true,
        paidAt: true,
        user: { select: { email: true, name: true } },
      },
    }),
    prisma.course.findMany({
      where: { publishedAt: { gte: since } },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        publishedAt: true,
        instructor: { select: { name: true, email: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        createdAt: true,
        actor: { select: { email: true, name: true } },
      },
    }),
  ]);

  const items: ActivityItem[] = [
    ...signups.map((u) => ({
      id: `s-${u.id}`,
      kind: "signup" as const,
      title: `Nouvelle inscription : ${u.name ?? u.email}`,
      subtitle: u.role,
      href: `/admin/utilisateurs/${u.id}`,
      createdAt: u.createdAt,
    })),
    ...orders.map((o) => ({
      id: `o-${o.id}`,
      kind: "order" as const,
      title: `Commande payée — ${(o.totalCents / 100).toFixed(2)} ${o.currency}`,
      subtitle: o.user.name ?? o.user.email,
      href: `/admin/finances/transactions?order=${o.id}`,
      createdAt: o.paidAt ?? new Date(),
    })),
    ...publications.map((c) => ({
      id: `c-${c.id}`,
      kind: "course-published" as const,
      title: `Formation publiée : ${c.title}`,
      subtitle: c.instructor.name ?? c.instructor.email,
      href: `/admin/cours/${c.id}`,
      createdAt: c.publishedAt ?? new Date(),
    })),
    ...audit.map((a) => ({
      id: `a-${a.id}`,
      kind: "audit" as const,
      title: `Action admin : ${a.action}`,
      subtitle: a.actor?.name ?? a.actor?.email ?? "système",
      createdAt: a.createdAt,
    })),
  ];

  return items
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}
