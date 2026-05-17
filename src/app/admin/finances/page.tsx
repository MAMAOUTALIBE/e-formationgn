import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Coins,
  PiggyBank,
  RefreshCw,
  Send,
  Wallet,
} from "lucide-react";

import { MonthlyFinanceChart } from "@/components/features/admin/charts/monthly-finance-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { periodToRange } from "@/lib/admin/period";
import { readPeriod } from "@/lib/admin/period-server";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  getFinanceHealthKpis,
  getFinancesKpis,
  getMonthlyFinanceSeries,
} from "@/server/queries/admin-finances";

export const metadata: Metadata = {
  title: "Finances — CRM admin",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function AdminFinancesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const range = periodToRange(await readPeriod(params.period ?? null));
  const [kpis, health, monthlySeries] = await Promise.all([
    getFinancesKpis(range),
    getFinanceHealthKpis(range),
    getMonthlyFinanceSeries(12),
  ]);

  // Delta % vs période précédente — pour KPI "Revenu net".
  const netDelta =
    health.netRevenuePreviousCents > 0
      ? ((health.netRevenueCents - health.netRevenuePreviousCents) /
          health.netRevenuePreviousCents) *
        100
      : health.netRevenueCents > 0
        ? 100
        : null;

  const REFUND_RATE_ALERT_THRESHOLD = 5; // % au-dessus duquel on alerte

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Finances
          </h1>
          <p className="text-sm text-muted-foreground">
            Vue financière globale (revenus bruts, commissions plateforme,
            payouts formateurs, remboursements).
          </p>
        </div>
        <DateRangePicker />
      </header>

      {/* Bandeau alerte si refund rate > seuil */}
      {health.refundRatePercent > REFUND_RATE_ALERT_THRESHOLD ? (
        <section className="flex items-start gap-3 rounded-lg border border-[color:var(--brand-danger)]/30 bg-[color:var(--brand-danger)]/5 p-4">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--brand-danger)]"
            aria-hidden
          />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-foreground">
              Taux de remboursement élevé : {health.refundRatePercent.toFixed(1)}%
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Seuil sain &lt; {REFUND_RATE_ALERT_THRESHOLD}%. Investiguer les
              motifs récents pour identifier un cours problématique ou un bug
              d&apos;achat.
            </p>
          </div>
          <Link
            href="/admin/finances/remboursements"
            className="shrink-0 text-sm font-medium text-[color:var(--brand-danger)] hover:underline"
          >
            Voir les refunds →
          </Link>
        </section>
      ) : null}

      {/* Bandeau alerte si chargebacks ouverts */}
      {health.chargebackCount > 0 ? (
        <section className="flex items-start gap-3 rounded-lg border border-[color:var(--brand-warning)]/30 bg-[color:var(--brand-warning)]/5 p-4">
          <AlertCircle
            className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--brand-warning)]"
            aria-hidden
          />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-foreground">
              {health.chargebackCount} chargeback
              {health.chargebackCount > 1 ? "s" : ""} ouvert
              {health.chargebackCount > 1 ? "s" : ""}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Répondre rapidement avec preuves d&apos;achat pour contester.
            </p>
          </div>
          <Link
            href="/admin/support/litiges"
            className="shrink-0 text-sm font-medium text-[color:var(--brand-warning)] hover:underline"
          >
            Voir litiges →
          </Link>
        </section>
      ) : null}

      {/* KPIs santé financière — pattern Stripe Dashboard */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Revenu net plateforme"
          value={`${(health.netRevenueCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}
          delta={netDelta}
          icon={<PiggyBank className="h-4 w-4" />}
          hint="Gross EUR − refunds EUR sur la période"
        />
        <KpiCard
          label="À reverser aux formateurs"
          value={`${(health.outstandingPayoutsCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}
          icon={<Send className="h-4 w-4" />}
          hint="Cumul payouts PENDING + PROCESSING"
          href="/admin/finances/payouts"
        />
        <KpiCard
          label="Taux de remboursement"
          value={`${health.refundRatePercent.toFixed(2)} %`}
          icon={<RefreshCw className="h-4 w-4" />}
          hint={
            health.refundRatePercent > REFUND_RATE_ALERT_THRESHOLD
              ? "⚠ au-dessus du seuil sain"
              : "Sain (< 5%)"
          }
        />
        <KpiCard
          label="Chargebacks ouverts"
          value={health.chargebackCount}
          icon={<AlertTriangle className="h-4 w-4" />}
          hint="Disputes à traiter"
          href="/admin/support/litiges"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Évolution sur 12 mois (EUR)</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Revenu brut, commission plateforme et remboursements mois par mois.
          </p>
        </CardHeader>
        <CardContent>
          <MonthlyFinanceChart data={monthlySeries} />
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Revenus bruts EUR"
          value={`${(kpis.grossByCurrency.EUR / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}
          icon={<Coins className="h-4 w-4" />}
          hint="Période sélectionnée"
        />
        <KpiCard
          label="Revenus bruts USD"
          value={`${(kpis.grossByCurrency.USD / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} $`}
          icon={<Coins className="h-4 w-4" />}
        />
        <KpiCard
          label="Commission plateforme EUR"
          value={`${(kpis.platformFeeByCurrency.EUR / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <KpiCard
          label="Commission plateforme USD"
          value={`${(kpis.platformFeeByCurrency.USD / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} $`}
          icon={<Wallet className="h-4 w-4" />}
        />
        <KpiCard
          label="À reverser EUR"
          value={`${(kpis.payoutsToInstructorsByCurrency.EUR / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}
          icon={<Send className="h-4 w-4" />}
          href="/admin/finances/payouts"
        />
        <KpiCard
          label="À reverser USD"
          value={`${(kpis.payoutsToInstructorsByCurrency.USD / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} $`}
          icon={<Send className="h-4 w-4" />}
          href="/admin/finances/payouts"
        />
        <KpiCard
          label="Remboursements EUR"
          value={`${(kpis.refundsByCurrency.EUR / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}
          icon={<RefreshCw className="h-4 w-4" />}
          href="/admin/finances/remboursements"
        />
        <KpiCard
          label="Échecs paiement (24 h)"
          value={kpis.failedOrders24h}
          icon={<AlertCircle className="h-4 w-4" />}
          href="/admin/finances/transactions?status=FAILED"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sous-modules</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <FinancesSubLink href="/admin/finances/transactions" label="Transactions" description="Toutes les commandes filtrables." />
            <FinancesSubLink href="/admin/finances/payouts" label="Payouts" description={`${kpis.pendingPayouts} en attente de paiement.`} />
            <FinancesSubLink href="/admin/finances/remboursements" label="Remboursements" description="Workflow de remboursement Stripe." />
            <FinancesSubLink href="/admin/finances/rapports" label="Rapports" description="Exports CSV mensuels." />
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function FinancesSubLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="block rounded-md border border-border p-3 transition-colors hover:bg-muted/50"
      >
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </Link>
    </li>
  );
}
