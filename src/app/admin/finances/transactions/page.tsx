import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { listAdminTransactions } from "@/server/queries/admin-finances";
import type { Currency, OrderStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Transactions" };

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: OrderStatus;
    currency?: Currency;
    page?: string;
  }>;
}

export default async function AdminTransactionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { rows, total, page, pageSize } = await listAdminTransactions({
    q: params.q,
    status: params.status,
    currency: params.currency,
    page: params.page ? Number(params.page) : 1,
    pageSize: 50,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Transactions
          </h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString("fr-FR")} commandes · page {page} / {totalPages}
          </p>
        </div>
      </header>

      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 sm:grid-cols-5">
            <Input
              name="q"
              placeholder="ID commande, email, Stripe…"
              defaultValue={params.q ?? ""}
              className="sm:col-span-2"
            />
            <Select name="status" defaultValue={params.status ?? ""} aria-label="Statut">
              <option value="">Tous statuts</option>
              <option value="PENDING">En cours</option>
              <option value="PROCESSING">Traitement</option>
              <option value="PAID">Payé</option>
              <option value="FAILED">Échoué</option>
              <option value="REFUNDED">Remboursé</option>
              <option value="PARTIALLY_REFUNDED">Partiellement remb.</option>
              <option value="CANCELLED">Annulé</option>
            </Select>
            <Select name="currency" defaultValue={params.currency ?? ""} aria-label="Devise">
              <option value="">Toutes devises</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </Select>
            <Button type="submit">Filtrer</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Commande</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="hidden px-4 py-3 lg:table-cell">Promo</th>
                <th className="hidden px-4 py-3 lg:table-cell">Date</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Aucune commande.
                  </td>
                </tr>
              ) : (
                rows.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 12)}…</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/utilisateurs/${o.user.id}`}
                        className="hover:underline"
                      >
                        {o.user.name ?? o.user.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {(o.totalCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}{" "}
                      {o.currency}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {o.promoCode ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                      {o.createdAt.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/finances/transactions/${o.id}`}
                        className="text-sm font-medium text-[color:var(--brand-secondary)] hover:underline"
                      >
                        Détail →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  if (status === "PAID") return <StatusBadge tone="success">Payé</StatusBadge>;
  if (status === "FAILED") return <StatusBadge tone="danger">Échoué</StatusBadge>;
  if (status === "REFUNDED") return <StatusBadge tone="warning">Remboursé</StatusBadge>;
  if (status === "PARTIALLY_REFUNDED") return <StatusBadge tone="warning">Remb. partiel</StatusBadge>;
  if (status === "CANCELLED") return <StatusBadge tone="neutral">Annulé</StatusBadge>;
  if (status === "PROCESSING") return <StatusBadge tone="info">Traitement</StatusBadge>;
  return <StatusBadge tone="neutral">{status}</StatusBadge>;
}
