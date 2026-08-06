"use server";

// Exports comptables (CSV) du module Finances.

import { requireAnyAdminRole } from "@/lib/auth/authorization";
import { checkUserRateLimit, rateLimitMessage } from "@/lib/auth/rate-limit-ip";
import { rowsToCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

const requireFinanceRole = () => requireAnyAdminRole("ADMIN", "FINANCE");

export async function exportFinancialReport(): Promise<
  { csv: string; filename: string } | { error: string }
> {
  let session;
  try {
    session = await requireFinanceRole();
  } catch {
    return { error: "Non autorisé." };
  }

  // Un export comptable est un geste humain ponctuel. Cette limite ne gêne
  // aucun usage légitime mais coupe court à un script qui bouclerait dessus
  // avec une session admin volée.
  const rl = await checkUserRateLimit({
    prefix: "admin:export:finance",
    userId: session.userId,
    windowMs: 10 * 60_000,
    max: 5,
  });
  if (!rl.ok) return { error: rateLimitMessage(rl.resetAt) };

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

  // Export comptable nominatif (emails clients + revenus formateurs) : tracé
  // comme une mutation, avec la période couverte pour pouvoir reconstituer
  // après coup ce qui est sorti.
  await createAuditLog({
    actorId: session.userId,
    action: "finance.export_report",
    targetType: "Order",
    targetId: null,
    metadata: {
      rowCount: rows.length,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
    },
  });

  const filename = `rapport-${start.toISOString().slice(0, 7)}.csv`;
  return { csv: rowsToCsv(rows), filename };
}
