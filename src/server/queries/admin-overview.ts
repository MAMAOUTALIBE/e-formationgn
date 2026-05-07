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
    prisma.lessonProgress.findMany({
      distinct: ["userId"],
      where: { updatedAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
      select: { userId: true },
    }),
  ]);

  const revenueByCurrency: Record<Currency, number> = { EUR: 0, USD: 0 };
  for (const r of revenueAgg) {
    revenueByCurrency[r.currency] = r._sum.totalCents ?? 0;
  }
  const revenuePreviousByCurrency: Record<Currency, number> = { EUR: 0, USD: 0 };
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
    activeStudents30d: activeStudents.length,
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

  const buckets = new Map<string, { EUR: number; USD: number }>();
  // Initialise toutes les dates de la plage à 0 pour un graphe sans trous.
  for (
    let d = new Date(range.from);
    d <= range.to;
    d.setDate(d.getDate() + 1)
  ) {
    buckets.set(toIsoDate(d), { EUR: 0, USD: 0 });
  }
  for (const o of orders) {
    if (!o.paidAt) continue;
    const key = toIsoDate(o.paidAt);
    const bucket = buckets.get(key) ?? { EUR: 0, USD: 0 };
    bucket[o.currency] += o.totalCents;
    buckets.set(key, bucket);
  }
  return Array.from(buckets.entries()).map(([date, v]) => ({
    date,
    EUR: v.EUR,
    USD: v.USD,
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
      title: c?.title ?? "(cours supprimé)",
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
  const items = await prisma.orderItem.findMany({
    where: {
      order: { status: "PAID", paidAt: { gte: range.from, lte: range.to } },
    },
    select: {
      currency: true,
      instructorPayoutCents: true,
      platformFeeCents: true,
      course: { select: { instructorId: true } },
    },
  });

  const map = new Map<
    string,
    { payout: number; fee: number; currency: Currency }
  >();
  for (const it of items) {
    const id = it.course.instructorId;
    const existing = map.get(id) ?? { payout: 0, fee: 0, currency: it.currency };
    existing.payout += it.instructorPayoutCents;
    existing.fee += it.platformFeeCents;
    map.set(id, existing);
  }

  const sorted = Array.from(map.entries())
    .sort((a, b) => b[1].payout - a[1].payout)
    .slice(0, limit);

  const ids = sorted.map(([id]) => id);
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true, firstName: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return sorted.map(([id, agg]) => {
    const u = userMap.get(id);
    return {
      id,
      name: u?.name ?? u?.firstName ?? "(supprimé)",
      email: u?.email ?? "",
      payoutCents: agg.payout,
      platformFeeCents: agg.fee,
      currency: agg.currency,
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
  const items = await prisma.orderItem.findMany({
    where: {
      order: { status: "PAID", paidAt: { gte: range.from, lte: range.to } },
    },
    select: {
      totalCents: true,
      course: { select: { categoryId: true } },
    },
  });
  const map = new Map<string, number>();
  for (const it of items) {
    map.set(it.course.categoryId, (map.get(it.course.categoryId) ?? 0) + it.totalCents);
  }
  const ids = Array.from(map.keys());
  const cats = await prisma.category.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([categoryId, revenueCents]) => ({
      categoryId,
      categoryName: catMap.get(categoryId) ?? "(supprimée)",
      revenueCents,
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
      label: `${pendingCourses} cours en attente de modération`,
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
      title: `Cours publié : ${c.title}`,
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
