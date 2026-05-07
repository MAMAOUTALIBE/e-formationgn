import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, Coins, RefreshCw, Send, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker, parsePeriodParam, periodToRange } from "@/components/ui/date-range-picker";
import { KpiCard } from "@/components/ui/kpi-card";
import { getFinancesKpis } from "@/server/queries/admin-finances";

export const metadata: Metadata = {
  title: "Finances — CRM admin",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function AdminFinancesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const range = periodToRange(parsePeriodParam(params.period ?? null));
  const kpis = await getFinancesKpis(range);

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
