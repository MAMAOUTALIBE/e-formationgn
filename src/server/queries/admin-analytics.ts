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
  const [pageViews, uniqueRows, cartItems, orders] = await Promise.all([
    prisma.pageView.count({ where }),
    // COUNT(DISTINCT) en base au lieu de charger toutes les sessions en mémoire
    // pour les dédupliquer en JS (PageView = la table la plus volumineuse).
    prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(DISTINCT "sessionId")::bigint AS n
      FROM "PageView"
      WHERE "createdAt" >= ${range.from} AND "createdAt" <= ${range.to}
    `,
    prisma.cartItem.count({
      where: { addedAt: { gte: range.from, lte: range.to } },
    }),
    prisma.order.count({
      where: { status: "PAID", paidAt: { gte: range.from, lte: range.to } },
    }),
  ]);
  return {
    totalPageViews: pageViews,
    uniqueSessions: Number(uniqueRows[0]?.n ?? 0),
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
  // GROUP BY source + LEFT JOIN OrderItem en base, au lieu de charger toutes
  // les inscriptions de la période pour les agréger en JS.
  const rows = await prisma.$queryRaw<
    Array<{ source: EnrollmentSource; count: bigint; rev: bigint }>
  >`
    SELECT e."source"::text AS source,
           COUNT(*)::bigint AS count,
           COALESCE(SUM(oi."totalCents"), 0)::bigint AS rev
    FROM "Enrollment" e
    LEFT JOIN "OrderItem" oi ON oi.id = e."orderItemId"
    WHERE e."enrolledAt" >= ${range.from} AND e."enrolledAt" <= ${range.to}
    GROUP BY e."source"
  `;
  return rows.map((r) => ({
    source: r.source,
    count: Number(r.count),
    revenueCents: Number(r.rev),
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

  // Cohortes calculées en base : signups par mois + rétention via EXISTS sur
  // LessonProgress — au lieu de charger tous les users et toute leur
  // progression en mémoire. Fenêtres préservées à l'identique :
  //   J30 : activité dans [createdAt+30j, createdAt+37j]
  //   J60 : activité >= createdAt+60j   ·   J90 : activité >= createdAt+90j
  const rows = await prisma.$queryRaw<
    Array<{ cohort: string; signups: bigint; d30: bigint; d60: bigint; d90: bigint }>
  >`
    SELECT to_char(date_trunc('month', u."createdAt"), 'YYYY-MM') AS cohort,
           COUNT(*)::bigint AS signups,
           COUNT(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM "LessonProgress" lp
               WHERE lp."userId" = u.id
                 AND lp."updatedAt" >= u."createdAt" + INTERVAL '30 days'
                 AND lp."updatedAt" <= u."createdAt" + INTERVAL '37 days'
             )
           )::bigint AS d30,
           COUNT(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM "LessonProgress" lp
               WHERE lp."userId" = u.id
                 AND lp."updatedAt" >= u."createdAt" + INTERVAL '60 days'
             )
           )::bigint AS d60,
           COUNT(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM "LessonProgress" lp
               WHERE lp."userId" = u.id
                 AND lp."updatedAt" >= u."createdAt" + INTERVAL '90 days'
             )
           )::bigint AS d90
    FROM "User" u
    WHERE u."createdAt" >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({
    cohortMonth: r.cohort,
    signups: Number(r.signups),
    retainedDay30: Number(r.d30),
    retainedDay60: Number(r.d60),
    retainedDay90: Number(r.d90),
  }));
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
  const emptyByCurrency = (): Record<Currency, number> => ({
    EUR: 0,
    USD: 0,
    GNF: 0,
    XOF: 0,
  });

  // AOV par devise = somme / nombre de commandes payées (groupBy en base).
  // Clients payants/récurrents, LTV par devise et top 10 clients via un CTE
  // « un agrégat par client » — au lieu de charger toutes les commandes payées.
  const [aovRows, totalUsers, perCurrencyRows, topRows] = await Promise.all([
    prisma.order.groupBy({
      by: ["currency"],
      where: { status: "PAID", paidAt: { gte: range.from, lte: range.to } },
      _sum: { totalCents: true },
      _count: true,
    }),
    prisma.user.count(),
    prisma.$queryRaw<
      Array<{
        currency: string;
        customers: bigint;
        ltv_sum: bigint;
        orders_sum: bigint;
        repeat_count: bigint;
      }>
    >`
      WITH per_user AS (
        SELECT o."userId" AS uid,
               MIN(o."currency"::text) AS currency,
               COUNT(*)::int AS orders,
               SUM(o."totalCents")::bigint AS spent
        FROM "Order" o
        WHERE o."status"::text = 'PAID'
          AND o."paidAt" >= ${range.from} AND o."paidAt" <= ${range.to}
        GROUP BY o."userId"
      )
      SELECT currency,
             COUNT(*)::bigint AS customers,
             SUM(spent)::bigint AS ltv_sum,
             SUM(orders)::bigint AS orders_sum,
             COUNT(*) FILTER (WHERE orders >= 2)::bigint AS repeat_count
      FROM per_user
      GROUP BY currency
    `,
    prisma.$queryRaw<
      Array<{
        uid: string;
        name: string | null;
        email: string;
        orders: number;
        spent: bigint;
        currency: string;
      }>
    >`
      WITH per_user AS (
        SELECT o."userId" AS uid,
               MIN(o."currency"::text) AS currency,
               COUNT(*)::int AS orders,
               SUM(o."totalCents")::bigint AS spent
        FROM "Order" o
        WHERE o."status"::text = 'PAID'
          AND o."paidAt" >= ${range.from} AND o."paidAt" <= ${range.to}
        GROUP BY o."userId"
      )
      SELECT pu.uid, u.name, u.email, pu.orders, pu.spent, pu.currency
      FROM per_user pu
      JOIN "User" u ON u.id = pu.uid
      ORDER BY pu.spent DESC
      LIMIT 10
    `,
  ]);

  const aovCentsByCurrency = emptyByCurrency();
  for (const r of aovRows) {
    aovCentsByCurrency[r.currency] =
      r._count > 0 ? (r._sum.totalCents ?? 0) / r._count : 0;
  }

  const ltvCentsByCurrency = emptyByCurrency();
  let payingCustomers = 0;
  let repeatCustomers = 0;
  let totalOrders = 0;
  for (const r of perCurrencyRows) {
    const customers = Number(r.customers);
    ltvCentsByCurrency[r.currency as Currency] =
      customers > 0 ? Number(r.ltv_sum) / customers : 0;
    payingCustomers += customers;
    repeatCustomers += Number(r.repeat_count);
    totalOrders += Number(r.orders_sum);
  }
  const averageOrdersPerCustomer =
    payingCustomers > 0 ? totalOrders / payingCustomers : 0;

  const topCustomers = topRows.map((r) => ({
    userId: r.uid,
    name: r.name,
    email: r.email,
    ordersCount: r.orders,
    totalSpentCents: Number(r.spent),
    currency: r.currency as Currency,
  }));

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
  // Deux agrégations SQL au lieu de charger tous les OrderItem payés avec un
  // include profond (coursesAuthored) qui rapatriait des arbres entiers.
  const [catRows, instrRows] = await Promise.all([
    prisma.$queryRaw<Array<{ categoryId: string; name: string; rev: bigint }>>`
      SELECT c."categoryId" AS "categoryId", cat."name" AS name,
             SUM(oi."totalCents")::bigint AS rev
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      JOIN "Course" c ON c.id = oi."courseId"
      JOIN "Category" cat ON cat.id = c."categoryId"
      WHERE o."status"::text = 'PAID'
        AND o."paidAt" >= ${range.from} AND o."paidAt" <= ${range.to}
      GROUP BY c."categoryId", cat."name"
      ORDER BY rev DESC
      LIMIT 5
    `,
    prisma.$queryRaw<Array<{ id: string; label: string; avg: number }>>`
      WITH sellers AS (
        SELECT DISTINCT c."instructorId" AS iid
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        JOIN "Course" c ON c.id = oi."courseId"
        WHERE o."status"::text = 'PAID'
          AND o."paidAt" >= ${range.from} AND o."paidAt" <= ${range.to}
      )
      SELECT u.id AS id,
             COALESCE(u.name, u.email) AS label,
             AVG(ca."averageRating")::float AS avg
      FROM sellers s
      JOIN "User" u ON u.id = s.iid
      JOIN "Course" ca ON ca."instructorId" = u.id
      WHERE ca."averageRating" > 0
      GROUP BY u.id, label
      ORDER BY avg DESC
      LIMIT 5
    `,
  ]);

  const topCategories = catRows.map((r) => ({
    label: r.name,
    value: Math.round(Number(r.rev) / 100),
    href: `/admin/cours?categoryId=${r.categoryId}`,
  }));
  const topInstructorsByRating = instrRows.map((r) => ({
    label: r.label,
    value: Math.round(Number(r.avg) * 10) / 10,
    href: `/admin/utilisateurs/${r.id}`,
  }));

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
