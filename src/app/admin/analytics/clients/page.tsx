import type { Metadata } from "next";
import Link from "next/link";
import { Coins, Repeat, ShoppingCart, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { KpiCard } from "@/components/ui/kpi-card";
import { periodToRange } from "@/lib/admin/period";
import { readPeriod } from "@/lib/admin/period-server";
import { formatMinor } from "@/lib/payments/currency";
import { getClientsKpis } from "@/server/queries/admin-analytics";
import type { Currency } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Clients (AOV & LTV)" };

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

function formatMultiCurrency(amounts: Record<Currency, number>): string {
  const entries = (Object.entries(amounts) as Array<[Currency, number]>)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  if (entries.length === 0) return "—";
  return entries.map(([cur, v]) => formatMinor(v, cur)).join(" · ");
}

export default async function AdminClientsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const range = periodToRange(await readPeriod(params.period ?? null));
  const kpis = await getClientsKpis(range);

  const repeatRate =
    kpis.payingCustomers > 0
      ? ((kpis.repeatCustomers / kpis.payingCustomers) * 100).toFixed(1)
      : "0.0";
  const conversionToBuy =
    kpis.totalCustomers > 0
      ? ((kpis.payingCustomers / kpis.totalCustomers) * 100).toFixed(2)
      : "0.00";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Clients
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Panier moyen (AOV), valeur vie (LTV) et top contributeurs.
          </p>
        </div>
        <DateRangePicker />
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total comptes"
          value={kpis.totalCustomers}
          icon={<Users className="h-4 w-4" />}
          hint="Tous les comptes créés"
        />
        <KpiCard
          label="Clients payants"
          value={kpis.payingCustomers}
          icon={<ShoppingCart className="h-4 w-4" />}
          hint={`${conversionToBuy}% des comptes`}
        />
        <KpiCard
          label="Clients récurrents"
          value={kpis.repeatCustomers}
          icon={<Repeat className="h-4 w-4" />}
          hint={`${repeatRate}% des payants (≥ 2 commandes)`}
        />
        <KpiCard
          label="Commandes / client"
          value={kpis.averageOrdersPerCustomer.toFixed(2)}
          icon={<Coins className="h-4 w-4" />}
          hint="Moyenne sur la période"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AOV — Panier moyen</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Revenu total / nombre de commandes payées sur la période.
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">
              {formatMultiCurrency(kpis.aovCentsByCurrency)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Augmenter l&apos;AOV = vendre plus de cours par panier (bundles,
              cross-sell, promo seuil).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">LTV — Valeur vie client</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Revenu total / clients distincts ayant payé sur la période.
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">
              {formatMultiCurrency(kpis.ltvCentsByCurrency)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Augmenter la LTV = fidéliser (newsletter, recommandations, séries
              de cours).
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 contributeurs</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Clients ayant le plus dépensé sur la période — à valoriser /
            interroger pour témoignages.
          </p>
        </CardHeader>
        <CardContent>
          {kpis.topCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun client payant sur la période sélectionnée.
            </p>
          ) : (
            <ul className="space-y-2">
              {kpis.topCustomers.map((c, idx) => (
                <li
                  key={c.userId}
                  className="flex items-center gap-3 rounded-md border border-border p-3 text-sm"
                >
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {idx + 1}
                  </span>
                  <Link
                    href={`/admin/utilisateurs/${c.userId}`}
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate font-medium text-foreground hover:underline">
                      {c.name ?? c.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.email}
                    </p>
                  </Link>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums text-foreground">
                      {formatMinor(c.totalSpentCents, c.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.ordersCount} commande{c.ordersCount > 1 ? "s" : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
