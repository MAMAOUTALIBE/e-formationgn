// Export CSV des transactions admin — applique les mêmes filtres que la page
// /admin/finances/transactions. Admin/Finance role only.
//
// Cap à 10 000 lignes par export pour éviter de timeout / OOM. Au-delà, l'admin
// doit affiner ses filtres ou demander un export DB direct.

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { ADMIN_ROLES } from "@/lib/constants";
import { csvResponseHeaders, rowsToCsv } from "@/lib/csv";
import { listAdminTransactions } from "@/server/queries/admin-finances";
import type {
  Currency,
  OrderStatus,
} from "@/generated/prisma/enums";

const MAX_ROWS = 10_000;

const ALLOWED_ROLES = [...ADMIN_ROLES, "FINANCE"] as readonly string[];

export async function GET(request: Request) {
  const session = await auth();
  if (
    !session?.user ||
    !ALLOWED_ROLES.includes(session.user.role)
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const status = (url.searchParams.get("status") as OrderStatus | null) ?? undefined;
  const currency = (url.searchParams.get("currency") as Currency | null) ?? undefined;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const { rows } = await listAdminTransactions({
    q,
    status,
    currency,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    pageSize: MAX_ROWS,
  });

  const csvRows = rows.map((r) => ({
    id: r.id,
    status: r.status,
    currency: r.currency,
    totalEUR: (r.totalCents / 100).toFixed(2),
    user_name: r.user.name ?? "",
    user_email: r.user.email,
    items_count: r.itemCount,
    promo: r.promoCode ?? "",
    created_at: r.createdAt.toISOString(),
    paid_at: r.paidAt ? r.paidAt.toISOString() : "",
  }));

  const filename = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(rowsToCsv(csvRows), {
    status: 200,
    headers: csvResponseHeaders(filename),
  });
}
