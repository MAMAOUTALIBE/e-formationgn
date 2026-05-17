"use server";

// Exports comptables (CSV) du module Finances.

import { requireAnyAdminRole } from "@/lib/auth/authorization";
import { rowsToCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

const requireFinanceRole = () => requireAnyAdminRole("ADMIN", "FINANCE");

export async function exportFinancialReport(): Promise<
  { csv: string; filename: string } | { error: string }
> {
  try {
    await requireFinanceRole();
  } catch {
    return { error: "Non autorisé." };
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const items = await prisma.orderItem.findMany({
    where: {
      order: { status: "PAID", paidAt: { gte: start, lte: end } },
    },
    include: {
      order: { select: { id: true, paidAt: true, user: { select: { email: true } } } },
      course: {
        select: {
          title: true,
          instructor: { select: { email: true, name: true } },
          category: { select: { name: true } },
        },
      },
    },
    orderBy: { order: { paidAt: "desc" } },
  });

  const rows = items.map((it) => ({
    orderId: it.order.id,
    paidAt: it.order.paidAt?.toISOString() ?? "",
    customerEmail: it.order.user.email,
    courseTitle: it.course.title,
    instructor: it.course.instructor.name ?? it.course.instructor.email,
    category: it.course.category.name,
    currency: it.currency,
    unitPrice: (it.unitPriceCents / 100).toFixed(2),
    discount: (it.discountCents / 100).toFixed(2),
    total: (it.totalCents / 100).toFixed(2),
    commissionRatePercent: (it.commissionRateBps / 100).toFixed(2),
    platformFee: (it.platformFeeCents / 100).toFixed(2),
    instructorPayout: (it.instructorPayoutCents / 100).toFixed(2),
    commissionSource: it.commissionSource,
  }));

  const filename = `rapport-${start.toISOString().slice(0, 7)}.csv`;
  return { csv: rowsToCsv(rows), filename };
}
