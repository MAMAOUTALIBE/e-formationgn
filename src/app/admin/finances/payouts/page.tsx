import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { markPayoutPaid } from "@/server/actions/admin-finances";
import { listAdminPayouts } from "@/server/queries/admin-finances";

export const metadata: Metadata = { title: "Payouts" };

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

export default async function AdminPayoutsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { rows, total } = await listAdminPayouts({
    status: params.status,
    page: params.page ? Number(params.page) : 1,
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Payouts (virements formateurs)
        </h1>
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString("fr-FR")} payouts. Marquez ceux qui ont été
          virés via Stripe Connect.
        </p>
      </header>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Formateur</th>
                <th className="px-4 py-3">Période</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="hidden px-4 py-3 lg:table-cell">Stripe</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Aucun payout en cours.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/utilisateurs/${p.instructor.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.instructor.name ?? p.instructor.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.periodStart.toLocaleDateString("fr-FR")} →{" "}
                      {p.periodEnd.toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <PayoutStatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {(p.amountCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}{" "}
                      {p.currency}
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-xs lg:table-cell">
                      {p.stripePayoutId ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.status !== "PAID" ? (
                        <form
                          action={async () => {
                            "use server";
                            await markPayoutPaid(p.id);
                          }}
                        >
                          <Button type="submit" size="sm" variant="outline">
                            Marquer payé
                          </Button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {p.paidAt?.toLocaleDateString("fr-FR")}
                        </span>
                      )}
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

function PayoutStatusBadge({ status }: { status: string }) {
  if (status === "PAID") return <StatusBadge tone="success">Payé</StatusBadge>;
  if (status === "PROCESSING") return <StatusBadge tone="info">En cours</StatusBadge>;
  if (status === "FAILED") return <StatusBadge tone="danger">Échoué</StatusBadge>;
  return <StatusBadge tone="warning">En attente</StatusBadge>;
}
