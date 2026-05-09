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
