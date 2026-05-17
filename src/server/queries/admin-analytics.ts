// Requêtes analytics avancées pour /admin/analytics.

import type { Prisma } from "@/generated/prisma/client";
import type { Currency, EnrollmentSource } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export interface ConversionFunnel {
  totalPageViews: number;
  uniqueSessions: number;
  cartItemsCreated: number;
  ordersPaid: number;
}

export async function getConversionFunnel(range: {
  from: Date;
  to: Date;
}): Promise<ConversionFunnel> {
  const where: Prisma.PageViewWhereInput = {
    createdAt: { gte: range.from, lte: range.to },
  };
  const [pageViews, uniqueSessions, cartItems, orders] = await Promise.all([
    prisma.pageView.count({ where }),
    prisma.pageView
      .findMany({
        where,
        select: { sessionId: true },
        distinct: ["sessionId"],
      })
      .then((s) => s.length),
    prisma.cartItem.count({
      where: { addedAt: { gte: range.from, lte: range.to } },
    }),
    prisma.order.count({
      where: { status: "PAID", paidAt: { gte: range.from, lte: range.to } },
    }),
  ]);
  return {
    totalPageViews: pageViews,
    uniqueSessions,
    cartItemsCreated: cartItems,
    ordersPaid: orders,
  };
}

export interface SalesBySource {
  source: EnrollmentSource;
  count: number;
  revenueCents: number;
}

export async function getSalesBySource(range: {
  from: Date;
  to: Date;
}): Promise<SalesBySource[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { enrolledAt: { gte: range.from, lte: range.to } },
    select: {
      source: true,
      orderItem: { select: { totalCents: true } },
    },
  });
  const map = new Map<EnrollmentSource, { count: number; revenueCents: number }>();
  for (const e of enrollments) {
    const existing = map.get(e.source) ?? { count: 0, revenueCents: 0 };
    existing.count += 1;
    existing.revenueCents += e.orderItem?.totalCents ?? 0;
    map.set(e.source, existing);
  }
  return Array.from(map.entries()).map(([source, agg]) => ({
    source,
    ...agg,
  }));
}

export interface CohortRow {
  cohortMonth: string; // YYYY-MM
  signups: number;
  retainedDay30: number;
  retainedDay60: number;
  retainedDay90: number;
}

export async function getCohorts(): Promise<CohortRow[]> {
  // Cohorte par mois d'inscription, retention = a fait au moins 1 leçon.
  const since = new Date();
  since.setMonth(since.getMonth() - 6);

  const users = await prisma.user.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id: true,
      createdAt: true,
      lessonProgress: { select: { updatedAt: true } },
    },
  });

  const cohorts = new Map<string, CohortRow>();
  for (const u of users) {
    const key = u.createdAt.toISOString().slice(0, 7);
    const row = cohorts.get(key) ?? {
      cohortMonth: key,
      signups: 0,
      retainedDay30: 0,
      retainedDay60: 0,
      retainedDay90: 0,
    };
    row.signups += 1;
    const day30 = new Date(u.createdAt.getTime() + 30 * 24 * 3600 * 1000);
    const day60 = new Date(u.createdAt.getTime() + 60 * 24 * 3600 * 1000);
    const day90 = new Date(u.createdAt.getTime() + 90 * 24 * 3600 * 1000);
    if (u.lessonProgress.some((p) => p.updatedAt >= day30 && p.updatedAt <= new Date(day30.getTime() + 7 * 24 * 3600 * 1000))) {
      row.retainedDay30 += 1;
    }
    if (u.lessonProgress.some((p) => p.updatedAt >= day60)) row.retainedDay60 += 1;
    if (u.lessonProgress.some((p) => p.updatedAt >= day90)) row.retainedDay90 += 1;
    cohorts.set(key, row);
  }
  return Array.from(cohorts.values()).sort((a, b) =>
    a.cohortMonth.localeCompare(b.cohortMonth),
  );
}

// AOV (Average Order Value) + LTV (Lifetime Value) — pilotage business critique.
// AOV = revenu total / nombre de commandes payées sur la période.
// LTV moyen = revenu total / nombre de clients distincts (ayant payé au moins
//   1 fois). Per-cohort plus tard si besoin.
export interface ClientsKpis {
  totalCustomers: number;
  payingCustomers: number;
  repeatCustomers: number; // clients avec >= 2 commandes
  aovCentsByCurrency: Record<Currency, number>;
  ltvCentsByCurrency: Record<Currency, number>;
  averageOrdersPerCustomer: number;
  topCustomers: Array<{
    userId: string;
    name: string | null;
    email: string;
    ordersCount: number;
    totalSpentCents: number;
    currency: Currency;
  }>;
}

export async function getClientsKpis(range: {
  from: Date;
  to: Date;
}): Promise<ClientsKpis> {
  const [paidOrders, totalUsers] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: "PAID",
        paidAt: { gte: range.from, lte: range.to },
      },
      select: {
        userId: true,
        totalCents: true,
        currency: true,
      },
    }),
    prisma.user.count(),
  ]);

  // AOV par devise
  const aovTotals = new Map<Currency, { sum: number; count: number }>();
  const customerSpend = new Map<
    string,
    { totalCents: number; ordersCount: number; currency: Currency }
  >();
  for (const o of paidOrders) {
    const a = aovTotals.get(o.currency) ?? { sum: 0, count: 0 };
    a.sum += o.totalCents;
    a.count += 1;
    aovTotals.set(o.currency, a);

    const c = customerSpend.get(o.userId) ?? {
      totalCents: 0,
      ordersCount: 0,
      currency: o.currency,
    };
    c.totalCents += o.totalCents;
    c.ordersCount += 1;
    customerSpend.set(o.userId, c);
  }

  const aovCentsByCurrency: Record<Currency, number> = {
    EUR: 0,
    USD: 0,
    GNF: 0,
    XOF: 0,
  };
  const ltvCentsByCurrency: Record<Currency, number> = {
    EUR: 0,
    USD: 0,
    GNF: 0,
    XOF: 0,
  };
  for (const [currency, agg] of aovTotals) {
    aovCentsByCurrency[currency] = agg.count > 0 ? agg.sum / agg.count : 0;
  }

  // LTV = totalSpent / distinct paying customers, par devise
  const ltvAggregates = new Map<Currency, { sum: number; customers: Set<string> }>();
  for (const [userId, c] of customerSpend) {
    const agg = ltvAggregates.get(c.currency) ?? { sum: 0, customers: new Set() };
    agg.sum += c.totalCents;
    agg.customers.add(userId);
    ltvAggregates.set(c.currency, agg);
  }
  for (const [currency, agg] of ltvAggregates) {
    ltvCentsByCurrency[currency] =
      agg.customers.size > 0 ? agg.sum / agg.customers.size : 0;
  }

  const payingCustomers = customerSpend.size;
  const repeatCustomers = Array.from(customerSpend.values()).filter(
    (c) => c.ordersCount >= 2,
  ).length;
  const totalOrders = paidOrders.length;
  const averageOrdersPerCustomer =
    payingCustomers > 0 ? totalOrders / payingCustomers : 0;

  // Top 10 clients (revenue total)
  const topCustomersIds = Array.from(customerSpend.entries())
    .sort((a, b) => b[1].totalCents - a[1].totalCents)
    .slice(0, 10)
    .map(([userId]) => userId);

  const topCustomersUsers = await prisma.user.findMany({
    where: { id: { in: topCustomersIds } },
    select: { id: true, name: true, email: true },
  });
  const topCustomers = topCustomersIds
    .map((id) => {
      const u = topCustomersUsers.find((x) => x.id === id);
      const spend = customerSpend.get(id);
      if (!u || !spend) return null;
      return {
        userId: id,
        name: u.name,
        email: u.email,
        ordersCount: spend.ordersCount,
        totalSpentCents: spend.totalCents,
        currency: spend.currency,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    totalCustomers: totalUsers,
    payingCustomers,
    repeatCustomers,
    aovCentsByCurrency,
    ltvCentsByCurrency,
    averageOrdersPerCustomer,
    topCustomers,
  };
}

export interface PerformancePoint {
  label: string;
  value: number;
  href?: string;
}

export async function getTopPerformers(range: {
  from: Date;
  to: Date;
}): Promise<{
  topCategories: PerformancePoint[];
  topInstructorsByRating: PerformancePoint[];
}> {
  const items = await prisma.orderItem.findMany({
    where: {
      order: { status: "PAID", paidAt: { gte: range.from, lte: range.to } },
    },
    select: {
      totalCents: true,
      currency: true,
      course: {
        select: {
          categoryId: true,
          category: { select: { name: true } },
          instructor: {
            select: {
              id: true,
              name: true,
              email: true,
              coursesAuthored: { select: { averageRating: true } },
            },
          },
        },
      },
    },
  });

  const catMap = new Map<string, { name: string; revenue: number }>();
  for (const it of items) {
    const c = catMap.get(it.course.categoryId) ?? {
      name: it.course.category.name,
      revenue: 0,
    };
    c.revenue += it.totalCents;
    catMap.set(it.course.categoryId, c);
  }
  const topCategories = Array.from(catMap.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([categoryId, v]) => ({
      label: v.name,
      value: Math.round(v.revenue / 100),
      href: `/admin/cours?categoryId=${categoryId}`,
    }));

  const instructorRatings = new Map<
    string,
    { id: string; name: string; ratings: number[] }
  >();
  for (const it of items) {
    const i = it.course.instructor;
    const existing = instructorRatings.get(i.id) ?? {
      id: i.id,
      name: i.name ?? i.email,
      ratings: [],
    };
    for (const c of i.coursesAuthored) {
      if (c.averageRating > 0) existing.ratings.push(c.averageRating);
    }
    instructorRatings.set(i.id, existing);
  }
  const topInstructorsByRating = Array.from(instructorRatings.values())
    .filter((i) => i.ratings.length > 0)
    .map((i) => ({
      label: i.name,
      value:
        Math.round((i.ratings.reduce((a, b) => a + b, 0) / i.ratings.length) * 10) /
        10,
      href: `/admin/utilisateurs/${i.id}`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return { topCategories, topInstructorsByRating };
}

export interface UtmSource {
  utmSource: string;
  views: number;
}

export async function getTopUtmSources(range: {
  from: Date;
  to: Date;
}): Promise<UtmSource[]> {
  const rows = await prisma.pageView.groupBy({
    by: ["utmSource"],
    where: {
      createdAt: { gte: range.from, lte: range.to },
      utmSource: { not: null },
    },
    _count: { _all: true },
    orderBy: { _count: { utmSource: "desc" } },
    take: 10,
  });
  return rows
    .filter((r): r is { utmSource: string; _count: { _all: number } } => r.utmSource !== null)
    .map((r) => ({ utmSource: r.utmSource, views: r._count._all }));
}

export type { Currency };
