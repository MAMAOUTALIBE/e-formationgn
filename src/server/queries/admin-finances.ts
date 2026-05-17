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
  const [orderItems, refunds, pendingPayouts, failedOrders] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        order: { status: "PAID", paidAt: { gte: range.from, lte: range.to } },
      },
      select: {
        currency: true,
        totalCents: true,
        platformFeeCents: true,
        instructorPayoutCents: true,
      },
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
  for (const it of orderItems) {
    grossByCurrency[it.currency] += it.totalCents;
    platformFeeByCurrency[it.currency] += it.platformFeeCents;
    payoutsToInstructorsByCurrency[it.currency] += it.instructorPayoutCents;
  }
  const refundsByCurrency: Record<Currency, number> = { EUR: 0, USD: 0, GNF: 0, XOF: 0 };
  for (const r of refunds) {
    refundsByCurrency[r.order.currency] += r.amountCents;
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

  const [items, refunds] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        order: { status: "PAID", paidAt: { gte: fromMonth } },
        currency: "EUR", // pour la V1 on aggrège en EUR (devise reporting plateforme)
      },
      select: {
        totalCents: true,
        platformFeeCents: true,
        order: { select: { id: true, paidAt: true } },
      },
    }),
    prisma.refund.findMany({
      where: { createdAt: { gte: fromMonth }, order: { currency: "EUR" } },
      select: { amountCents: true, createdAt: true },
    }),
  ]);

  // Init buckets
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

  const seenOrders = new Set<string>();
  for (const it of items) {
    if (!it.order.paidAt) continue;
    const key = `${it.order.paidAt.getFullYear()}-${String(it.order.paidAt.getMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key);
    if (!b) continue;
    b.grossCents += it.totalCents;
    b.platformFeeCents += it.platformFeeCents;
    if (!seenOrders.has(it.order.id)) {
      b.ordersCount += 1;
      seenOrders.add(it.order.id);
    }
  }
  for (const r of refunds) {
    const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key);
    if (b) b.refundsCents += r.amountCents;
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

  const [grossRows, refundsRows, prevGrossRows, prevRefundsRows, chargebacks, payouts] =
    await Promise.all([
      prisma.orderItem.findMany({
        where: {
          order: { status: "PAID", paidAt: { gte: range.from, lte: range.to } },
          currency: "EUR",
        },
        select: { totalCents: true },
      }),
      prisma.refund.findMany({
        where: {
          createdAt: { gte: range.from, lte: range.to },
          order: { currency: "EUR" },
        },
        select: { amountCents: true },
      }),
      prisma.orderItem.findMany({
        where: {
          order: {
            status: "PAID",
            paidAt: { gte: previousRange.from, lte: previousRange.to },
          },
          currency: "EUR",
        },
        select: { totalCents: true },
      }),
      prisma.refund.findMany({
        where: {
          createdAt: { gte: previousRange.from, lte: previousRange.to },
          order: { currency: "EUR" },
        },
        select: { amountCents: true },
      }),
      prisma.dispute.count({ where: { status: "OPEN" } }),
      prisma.payout.aggregate({
        where: { status: { in: ["PENDING", "PROCESSING"] } },
        _sum: { amountCents: true },
      }),
    ]);

  const grossCents = grossRows.reduce((s, r) => s + r.totalCents, 0);
  const refundsCents = refundsRows.reduce((s, r) => s + r.amountCents, 0);
  const prevGross = prevGrossRows.reduce((s, r) => s + r.totalCents, 0);
  const prevRefunds = prevRefundsRows.reduce((s, r) => s + r.amountCents, 0);

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
