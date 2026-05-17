import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { periodToRange } from "@/lib/admin/period";
import { readPeriod } from "@/lib/admin/period-server";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  getConversionFunnel,
  getSalesBySource,
  getTopPerformers,
  getTopUtmSources,
} from "@/server/queries/admin-analytics";

export const metadata: Metadata = { title: "Analytics" };

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function AdminAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const range = periodToRange(await readPeriod(params.period ?? null));

  const [funnel, bySource, performers, utm] = await Promise.all([
    getConversionFunnel(range),
    getSalesBySource(range),
    getTopPerformers(range),
    getTopUtmSources(range),
  ]);

  const conversionRate =
    funnel.uniqueSessions > 0
      ? ((funnel.ordersPaid / funnel.uniqueSessions) * 100).toFixed(2)
      : "0.00";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Conversion, sources, cohortes et top performers.
          </p>
        </div>
        <DateRangePicker />
      </header>

      {/* Sous-sections analytics — Udemy-style nav cards */}
      <nav aria-label="Sections analytics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Link
          href="/admin/analytics/funnel"
          className="rounded-lg border border-border bg-card p-3 text-sm font-medium text-foreground transition-colors hover:border-[color:var(--brand-secondary)] hover:bg-muted/50"
        >
          📊 Funnel de conversion
        </Link>
        <Link
          href="/admin/analytics/clients"
          className="rounded-lg border border-border bg-card p-3 text-sm font-medium text-foreground transition-colors hover:border-[color:var(--brand-secondary)] hover:bg-muted/50"
        >
          💰 Clients (AOV / LTV)
        </Link>
        <Link
          href="/admin/analytics/cohortes"
          className="rounded-lg border border-border bg-card p-3 text-sm font-medium text-foreground transition-colors hover:border-[color:var(--brand-secondary)] hover:bg-muted/50"
        >
          🔁 Cohortes rétention
        </Link>
        <Link
          href="/admin/analytics/revenus"
          className="rounded-lg border border-border bg-card p-3 text-sm font-medium text-foreground transition-colors hover:border-[color:var(--brand-secondary)] hover:bg-muted/50"
        >
          📈 Revenus
        </Link>
        <Link
          href="/admin/analytics/apprentissage"
          className="rounded-lg border border-border bg-card p-3 text-sm font-medium text-foreground transition-colors hover:border-[color:var(--brand-secondary)] hover:bg-muted/50"
        >
          🎓 Apprentissage
        </Link>
      </nav>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entonnoir de conversion</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <FunnelStep label="Pages vues" value={funnel.totalPageViews} />
          <FunnelStep label="Sessions uniques" value={funnel.uniqueSessions} />
          <FunnelStep label="Articles ajoutés au panier" value={funnel.cartItemsCreated} />
          <FunnelStep label="Commandes payées" value={funnel.ordersPaid} />
        </CardContent>
        <CardContent className="border-t border-border pt-4">
          <p className="text-sm">
            Taux de conversion :{" "}
            <span className="text-lg font-semibold text-[color:var(--brand-primary)]">
              {conversionRate} %
            </span>{" "}
            (sessions → commandes)
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventes par source</CardTitle>
          </CardHeader>
          <CardContent>
            {bySource.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente sur la période.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {bySource.map((s) => (
                  <li key={s.source} className="flex items-center justify-between py-2">
                    <span>{s.source}</span>
                    <span className="text-muted-foreground">
                      {s.count} · {(s.revenueCents / 100).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top sources UTM</CardTitle>
          </CardHeader>
          <CardContent>
            {utm.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun trafic UTM tracké. Activez le tracking via{" "}
                <code>/api/track</code>.
              </p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {utm.map((u) => (
                  <li
                    key={u.utmSource}
                    className="flex items-center justify-between py-2"
                  >
                    <span>{u.utmSource}</span>
                    <span className="text-muted-foreground">{u.views} vues</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top catégories</CardTitle>
          </CardHeader>
          <CardContent>
            {performers.topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {performers.topCategories.map((p) => (
                  <li key={p.label} className="flex items-center justify-between py-2">
                    {p.href ? (
                      <Link href={p.href} className="hover:underline">
                        {p.label}
                      </Link>
                    ) : (
                      <span>{p.label}</span>
                    )}
                    <span className="font-medium">{p.value}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top formateurs (note moyenne)</CardTitle>
          </CardHeader>
          <CardContent>
            {performers.topInstructorsByRating.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune note sur la période.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {performers.topInstructorsByRating.map((p) => (
                  <li key={p.label} className="flex items-center justify-between py-2">
                    {p.href ? (
                      <Link href={p.href} className="hover:underline">
                        {p.label}
                      </Link>
                    ) : (
                      <span>{p.label}</span>
                    )}
                    <span className="font-medium">{p.value} ★</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sous-modules</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <li>
              <Link href="/admin/analytics/cohortes" className="block rounded-md border border-border p-3 hover:bg-muted/50">
                <p className="font-medium">Cohortes</p>
                <p className="text-xs text-muted-foreground">Rétention 30/60/90 j par mois d&apos;inscription.</p>
              </Link>
            </li>
            <li>
              <Link href="/admin/analytics/revenus" className="block rounded-md border border-border p-3 hover:bg-muted/50">
                <p className="font-medium">Revenus détaillés</p>
                <p className="text-xs text-muted-foreground">Comparaison période précédente, breakdown.</p>
              </Link>
            </li>
            <li>
              <Link href="/admin/analytics/apprentissage" className="block rounded-md border border-border p-3 hover:bg-muted/50">
                <p className="font-medium">Apprentissage</p>
                <p className="text-xs text-muted-foreground">Quiz, certificats, taux de complétion.</p>
              </Link>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function FunnelStep({ label, value }: { label: string; value: number }) {
  return (
    <KpiCard label={label} value={value} />
  );
}
