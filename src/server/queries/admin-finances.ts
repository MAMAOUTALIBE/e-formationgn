// Requêtes financières pour le module /admin/finances.

import type { Prisma } from "@/generated/prisma/client";
import type { Currency, OrderStatus, PayoutStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export interface FinancesKpis {
  grossByCurrency: Record<Currency, number>;
  platformFeeByCurrency: Record<Currency, number>;
  payoutsToInstructorsByCurrency: Record<Currency, number>;
  refundsByCurrency: Record<Currency, number>;
  pendingPayouts: number;
  failedOrders24h: number;
}

export async function getFinancesKpis(range: {
  from: Date;
  to: Date;
}): Promise<FinancesKpis> {
  // Agrégation côté base (GROUP BY currency) plutôt que de charger tous les
  // OrderItem en mémoire pour les sommer en JS — la table grossit avec les
  // ventes, le SUM SQL reste O(1) côté Node.
  const [itemAgg, refunds, pendingPayouts, failedOrders] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["currency"],
      where: {
        order: { status: "PAID", paidAt: { gte: range.from, lte: range.to } },
      },
      _sum: { totalCents: true, platformFeeCents: true, instructorPayoutCents: true },
    }),
    prisma.refund.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: { amountCents: true, order: { select: { currency: true } } },
    }),
    prisma.payout.count({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
    }),
    prisma.order.count({
      where: {
        status: "FAILED",
        updatedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
      },
    }),
  ]);

  const grossByCurrency: Record<Currency, number> = { EUR: 0, USD: 0, GNF: 0, XOF: 0 };
  const platformFeeByCurrency: Record<Currency, number> = { EUR: 0, USD: 0, GNF: 0, XOF: 0 };
  const payoutsToInstructorsByCurrency: Record<Currency, number> = { EUR: 0, USD: 0, GNF: 0, XOF: 0 };
  for (const row of itemAgg) {
    grossByCurrency[row.currency] = row._sum.totalCents ?? 0;
    platformFeeByCurrency[row.currency] = row._sum.platformFeeCents ?? 0;
    payoutsToInstructorsByCurrency[row.currency] = row._sum.instructorPayoutCents ?? 0;
  }
  const refundsByCurrency: Record<Currency, number> = { EUR: 0, USD: 0, GNF: 0, XOF: 0 };
  for (const r of refunds) {
    if (r.order) refundsByCurrency[r.order.currency] += r.amountCents;
  }

  return {
    grossByCurrency,
    platformFeeByCurrency,
    payoutsToInstructorsByCurrency,
    refundsByCurrency,
    pendingPayouts,
    failedOrders24h: failedOrders,
  };
}

// Série mensuelle revenu / commission / refund — pattern Stripe Dashboard.
// Retourne les 12 derniers mois pour graphique MRR-like.
export interface MonthlyFinancePoint {
  month: string; // YYYY-MM
  grossCents: number; // tous orders payés ce mois (en EUR converti côté UI)
  platformFeeCents: number; // commission plateforme
  refundsCents: number; // remboursements émis ce mois
  ordersCount: number;
}

export async function getMonthlyFinanceSeries(
  months = 12,
): Promise<MonthlyFinancePoint[]> {
  const now = new Date();
  const fromMonth = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  // Agrégation mensuelle directement en SQL (date_trunc + GROUP BY) au lieu de
  // charger tous les OrderItem des 12 derniers mois en mémoire pour les bucketer
  // en JS. COUNT(DISTINCT order_id) remplace le Set de dédup applicatif.
  // V1 : reporting en EUR uniquement (devise plateforme).
  const [grossRows, refundRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{ month: string; gross: bigint; fee: bigint; orders: bigint }>
    >`
      SELECT to_char(date_trunc('month', o."paidAt"), 'YYYY-MM') AS month,
             COALESCE(SUM(oi."totalCents"), 0)::bigint AS gross,
             COALESCE(SUM(oi."platformFeeCents"), 0)::bigint AS fee,
             COUNT(DISTINCT o.id)::bigint AS orders
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."status"::text = 'PAID'
        AND oi."currency"::text = 'EUR'
        AND o."paidAt" >= ${fromMonth}
      GROUP BY 1
    `,
    prisma.$queryRaw<Array<{ month: string; refunds: bigint }>>`
      SELECT to_char(date_trunc('month', r."createdAt"), 'YYYY-MM') AS month,
             COALESCE(SUM(r."amountCents"), 0)::bigint AS refunds
      FROM "Refund" r
      JOIN "Order" o ON o.id = r."orderId"
      WHERE o."currency"::text = 'EUR'
        AND r."createdAt" >= ${fromMonth}
      GROUP BY 1
    `,
  ]);

  // Init buckets (garantit les 12 mois présents, même à zéro).
  const buckets = new Map<string, MonthlyFinancePoint>();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, {
      month: key,
      grossCents: 0,
      platformFeeCents: 0,
      refundsCents: 0,
      ordersCount: 0,
    });
  }

  for (const row of grossRows) {
    const b = buckets.get(row.month);
    if (!b) continue;
    b.grossCents = Number(row.gross);
    b.platformFeeCents = Number(row.fee);
    b.ordersCount = Number(row.orders);
  }
  for (const row of refundRows) {
    const b = buckets.get(row.month);
    if (b) b.refundsCents = Number(row.refunds);
  }

  return Array.from(buckets.values());
}

// KPIs santé financière : net revenue + refund rate + delta période précédente.
// Tout exprimé en EUR (reporting plateforme), conversion à la charge de la
// devise locale ailleurs.
export interface FinanceHealthKpis {
  netRevenueCents: number; // gross EUR - refunds EUR
  netRevenuePreviousCents: number;
  refundRatePercent: number; // refunds / gross
  chargebackCount: number; // disputes ouvertes
  outstandingPayoutsCents: number; // somme à verser aux formateurs (PENDING)
}

export async function getFinanceHealthKpis(range: {
  from: Date;
  to: Date;
}): Promise<FinanceHealthKpis> {
  const durationMs = range.to.getTime() - range.from.getTime();
  const previousRange = {
    from: new Date(range.from.getTime() - durationMs),
    to: range.from,
  };

  // SUM côté base (aggregate _sum) au lieu de charger toutes les lignes pour
  // les additionner en JS — même résultat, charge mémoire constante.
  const [grossAgg, refundsAgg, prevGrossAgg, prevRefundsAgg, chargebacks, payouts] =
    await Promise.all([
      prisma.orderItem.aggregate({
        where: {
          order: { status: "PAID", paidAt: { gte: range.from, lte: range.to } },
          currency: "EUR",
        },
        _sum: { totalCents: true },
      }),
      prisma.refund.aggregate({
        where: {
          createdAt: { gte: range.from, lte: range.to },
          order: { currency: "EUR" },
        },
        _sum: { amountCents: true },
      }),
      prisma.orderItem.aggregate({
        where: {
          order: {
            status: "PAID",
            paidAt: { gte: previousRange.from, lte: previousRange.to },
          },
          currency: "EUR",
        },
        _sum: { totalCents: true },
      }),
      prisma.refund.aggregate({
        where: {
          createdAt: { gte: previousRange.from, lte: previousRange.to },
          order: { currency: "EUR" },
        },
        _sum: { amountCents: true },
      }),
      prisma.dispute.count({ where: { status: "OPEN" } }),
      prisma.payout.aggregate({
        where: { status: { in: ["PENDING", "PROCESSING"] } },
        _sum: { amountCents: true },
      }),
    ]);

  const grossCents = grossAgg._sum.totalCents ?? 0;
  const refundsCents = refundsAgg._sum.amountCents ?? 0;
  const prevGross = prevGrossAgg._sum.totalCents ?? 0;
  const prevRefunds = prevRefundsAgg._sum.amountCents ?? 0;

  return {
    netRevenueCents: grossCents - refundsCents,
    netRevenuePreviousCents: prevGross - prevRefunds,
    refundRatePercent: grossCents > 0 ? (refundsCents / grossCents) * 100 : 0,
    chargebackCount: chargebacks,
    outstandingPayoutsCents: payouts._sum.amountCents ?? 0,
  };
}

export interface AdminTransactionRow {
  id: string;
  status: OrderStatus;
  currency: Currency;
  totalCents: number;
  user: { id: string; name: string | null; email: string };
  createdAt: Date;
  paidAt: Date | null;
  promoCode: string | null;
  itemCount: number;
}

export async function listAdminTransactions(filters: {
  q?: string;
  status?: OrderStatus;
  currency?: Currency;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: AdminTransactionRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, filters.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const where: Prisma.OrderWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.currency) where.currency = filters.currency;
  const createdAt: Prisma.DateTimeFilter = {};
  if (filters.from) createdAt.gte = filters.from;
  if (filters.to) createdAt.lte = filters.to;
  if (filters.from || filters.to) where.createdAt = createdAt;
  if (filters.q && filters.q.trim().length > 0) {
    const q = filters.q.trim();
    where.OR = [
      { id: { contains: q } },
      { stripeCheckoutSessionId: { contains: q } },
      { stripePaymentIntentId: { contains: q } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        user: { select: { id: true, name: true, email: true } },
        promoCode: { select: { code: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    rows: orders.map((o) => ({
      id: o.id,
      status: o.status,
      currency: o.currency,
      totalCents: o.totalCents,
      user: o.user,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      promoCode: o.promoCode?.code ?? null,
      itemCount: o._count.items,
    })),
    total,
    page,
    pageSize,
  };
}

export async function getAdminOrderDetail(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          course: { select: { title: true, slug: true } },
        },
      },
      refunds: { orderBy: { createdAt: "desc" } },
      promoCode: { select: { code: true } },
    },
  });
}

export interface PayoutRow {
  id: string;
  amountCents: number;
  currency: Currency;
  status: string;
  stripePayoutId: string | null;
  periodStart: Date;
  periodEnd: Date;
  paidAt: Date | null;
  instructor: { id: string; name: string | null; email: string };
}

export async function listAdminPayouts(filters: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: PayoutRow[]; total: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = 50;
  const skip = (page - 1) * pageSize;
  const where: Prisma.PayoutWhereInput | undefined = filters.status
    ? { status: filters.status as PayoutStatus }
    : undefined;
  const [rows, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        instructor: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.payout.count({ where }),
  ]);
  return {
    rows: rows.map((p) => ({
      id: p.id,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      stripePayoutId: p.stripePayoutId,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      paidAt: p.paidAt,
      instructor: p.instructor,
    })),
    total,
  };
}
