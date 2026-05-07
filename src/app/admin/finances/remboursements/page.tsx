import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Remboursements" };

export const dynamic = "force-dynamic";

export default async function AdminRefundsPage() {
  const refunds = await prisma.refund.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      order: {
        select: {
          id: true,
          currency: true,
          status: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Remboursements
        </h1>
        <p className="text-sm text-muted-foreground">
          {refunds.length} remboursements récents. Pour rembourser une
          commande, ouvrez sa fiche transaction.
        </p>
      </header>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Commande</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="hidden px-4 py-3 lg:table-cell">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {refunds.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Aucun remboursement.
                  </td>
                </tr>
              ) : (
                refunds.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.createdAt.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/finances/transactions/${r.order.id}`}
                        className="font-mono text-xs hover:underline"
                      >
                        {r.order.id.slice(0, 12)}…
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/utilisateurs/${r.order.user.id}`}
                        className="hover:underline"
                      >
                        {r.order.user.name ?? r.order.user.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {(r.amountCents / 100).toFixed(2)} {r.order.currency}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <StatusBadge tone="success">Effectué</StatusBadge>
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
