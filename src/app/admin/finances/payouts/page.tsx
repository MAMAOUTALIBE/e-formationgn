import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, Send, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { markPayoutPaid } from "@/server/actions/admin-finances";
import { prisma } from "@/lib/prisma";
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

  // Stats globales (toutes périodes confondues) pour la barre KPI
  const [pendingSum, processingSum, paidSum, failedSum, statusCounts] =
    await Promise.all([
      prisma.payout.aggregate({
        where: { status: "PENDING" },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      prisma.payout.aggregate({
        where: { status: "PROCESSING" },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      prisma.payout.aggregate({
        where: { status: "PAID" },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      prisma.payout.aggregate({
        where: { status: "FAILED" },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      prisma.payout.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

  const countByStatus: Record<string, number> = {};
  for (const s of statusCounts) countByStatus[s.status] = s._count._all;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <Send className="h-6 w-6 text-[color:var(--brand-primary)]" aria-hidden />
          Payouts formateurs
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          File des virements via Stripe Connect — marquez ceux exécutés en
          dehors de Stripe (virement manuel).
        </p>
      </header>

      {/* KPIs par statut */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="En attente"
          value={pendingSum._count._all}
          icon={<Clock className="h-4 w-4" />}
          hint={`${((pendingSum._sum.amountCents ?? 0) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € à reverser`}
        />
        <KpiCard
          label="En cours"
          value={processingSum._count._all}
          icon={<Send className="h-4 w-4" />}
          hint={`${((processingSum._sum.amountCents ?? 0) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € en transit`}
        />
        <KpiCard
          label="Payés (total)"
          value={paidSum._count._all}
          icon={<CheckCircle2 className="h-4 w-4" />}
          hint={`${((paidSum._sum.amountCents ?? 0) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € cumulés`}
        />
        <KpiCard
          label="Échoués"
          value={failedSum._count._all}
          icon={<XCircle className="h-4 w-4" />}
          hint={`${((failedSum._sum.amountCents ?? 0) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € à investiguer`}
        />
      </section>

      {/* Tabs filtre statut */}
      <nav aria-label="Filtres statut" className="flex flex-wrap gap-1 border-b border-border">
        <TabLink href="/admin/finances/payouts" active={!params.status}>
          Tous
          <span className="ml-1.5 text-xs text-muted-foreground">
            ({total})
          </span>
        </TabLink>
        {(
          [
            ["PENDING", "En attente"],
            ["PROCESSING", "En cours"],
            ["PAID", "Payés"],
            ["FAILED", "Échoués"],
          ] as const
        ).map(([status, label]) => (
          <TabLink
            key={status}
            href={`/admin/finances/payouts?status=${status}`}
            active={params.status === status}
          >
            {label}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({countByStatus[status] ?? 0})
            </span>
          </TabLink>
        ))}
      </nav>

      {failedSum._count._all > 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-[color:var(--brand-danger)]/30 bg-[color:var(--brand-danger)]/5 p-3 text-sm">
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-danger)]"
            aria-hidden
          />
          <p>
            <strong>{failedSum._count._all} payout(s) en échec</strong> —
            vérifiez la configuration Stripe Connect du formateur (compte
            désactivé, IBAN invalide, etc.) avant de retenter manuellement.
          </p>
        </div>
      ) : null}

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
                    Aucun payout dans ce filtre.
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
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
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

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "-mb-px inline-flex items-center border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-[color:var(--brand-secondary)] text-foreground"
          : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function PayoutStatusBadge({ status }: { status: string }) {
  if (status === "PAID") return <StatusBadge tone="success">Payé</StatusBadge>;
  if (status === "PROCESSING") return <StatusBadge tone="info">En cours</StatusBadge>;
  if (status === "FAILED") return <StatusBadge tone="danger">Échoué</StatusBadge>;
  return <StatusBadge tone="warning">En attente</StatusBadge>;
}
