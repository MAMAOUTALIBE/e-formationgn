import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BookOpenText,
  CheckCircle2,
  Coins,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";

import { CategoryDonut } from "@/components/features/admin/charts/category-donut";
import { RevenueChart } from "@/components/features/admin/charts/revenue-chart";
import { Sparkline } from "@/components/features/admin/charts/sparkline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { periodToRange } from "@/lib/admin/period";
import { readPeriod } from "@/lib/admin/period-server";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getAdminAlerts,
  getAdminOverviewKpis,
  getRecentActivity,
  getRevenueByCategory,
  getRevenueTimeseries,
  getTopCoursesByRevenue,
  getTopInstructorsByRevenue,
} from "@/server/queries/admin-overview";

export const metadata: Metadata = {
  title: "Vue d'ensemble — CRM admin",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function AdminOverviewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = await readPeriod(params.period ?? null);
  const range = periodToRange(period);

  const [kpis, timeseries, topCourses, topInstructors, byCategory, alerts, activity] =
    await Promise.all([
      getAdminOverviewKpis(range),
      getRevenueTimeseries(range),
      getTopCoursesByRevenue(range, 5),
      getTopInstructorsByRevenue(range, 5),
      getRevenueByCategory(range),
      getAdminAlerts(),
      getRecentActivity(20),
    ]);

  const revenueDeltaEur = computeDelta(
    kpis.revenueByCurrency.EUR,
    kpis.revenuePreviousByCurrency.EUR,
  );
  const revenueDeltaUsd = computeDelta(
    kpis.revenueByCurrency.USD,
    kpis.revenuePreviousByCurrency.USD,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Vue d&apos;ensemble
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pilotage de la plateforme — toutes les métriques sont à jour à la
            période sélectionnée.
          </p>
        </div>
        <DateRangePicker />
      </header>

      {alerts.length > 0 ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Actions requises
              </p>
              <ul className="mt-2 grid gap-1.5 text-sm text-amber-900 dark:text-amber-100 sm:grid-cols-2">
                {alerts.map((a) => (
                  <li key={a.kind}>
                    <Link
                      href={a.href}
                      className="inline-flex items-center gap-1.5 hover:underline"
                    >
                      <span aria-hidden>•</span>
                      {a.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Revenus EUR"
          value={`${(kpis.revenueByCurrency.EUR / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}
          delta={revenueDeltaEur}
          icon={<Coins className="h-4 w-4" />}
          hint="Période sélectionnée"
          sparkline={<Sparkline data={timeseries.map((p) => p.EUR)} color="#1E3A8A" />}
        />
        <KpiCard
          label="Revenus USD"
          value={`${(kpis.revenueByCurrency.USD / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} $`}
          delta={revenueDeltaUsd}
          icon={<Coins className="h-4 w-4" />}
          hint="Période sélectionnée"
          sparkline={<Sparkline data={timeseries.map((p) => p.USD)} color="#0EA5E9" />}
        />
        <KpiCard
          label="Commandes"
          value={kpis.ordersCount}
          icon={<ShoppingCart className="h-4 w-4" />}
          hint="Payées sur la période"
        />
        <KpiCard
          label="Nouveaux inscrits"
          value={kpis.newSignups}
          icon={<Users className="h-4 w-4" />}
          hint="Comptes créés"
        />
        <KpiCard
          label="Cours publiés"
          value={kpis.newCourses}
          icon={<BookOpenText className="h-4 w-4" />}
          hint="Sur la période"
        />
        <KpiCard
          label="Élèves actifs"
          value={kpis.activeStudents30d}
          icon={<Activity className="h-4 w-4" />}
          hint="Au moins 1 leçon ces 30 j"
        />
        <KpiCard
          label="Complétion moyenne"
          value={`${kpis.averageCompletionPercent} %`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          hint="Inscriptions de la période"
        />
        <KpiCard
          label="En attente modération"
          value={kpis.pendingCoursesCount}
          icon={<TrendingUp className="h-4 w-4" />}
          hint="Cours à examiner"
          href="/admin/cours?status=PENDING_REVIEW"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenus sur la période</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={timeseries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenus par catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryDonut data={byCategory.slice(0, 8)} />
            {byCategory.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs">
                {byCategory.slice(0, 5).map((c) => (
                  <li
                    key={c.categoryId}
                    className="flex items-center justify-between gap-2 text-muted-foreground"
                  >
                    <span className="truncate">{c.categoryName}</span>
                    <span className="font-medium text-foreground">
                      {(c.revenueCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 cours</CardTitle>
          </CardHeader>
          <CardContent>
            {topCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente sur la période.</p>
            ) : (
              <ul className="space-y-2">
                {topCourses.map((c, idx) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-md border border-border p-2 text-sm"
                  >
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {idx + 1}
                    </span>
                    <Link href={`/admin/cours/${c.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.ordersCount} commande{c.ordersCount > 1 ? "s" : ""}
                      </p>
                    </Link>
                    <span className="shrink-0 text-sm font-semibold">
                      {(c.revenueCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}{" "}
                      {c.currency}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 formateurs</CardTitle>
          </CardHeader>
          <CardContent>
            {topInstructors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune vente sur la période.</p>
            ) : (
              <ul className="space-y-2">
                {topInstructors.map((i, idx) => (
                  <li
                    key={i.id}
                    className="flex items-center gap-3 rounded-md border border-border p-2 text-sm"
                  >
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {idx + 1}
                    </span>
                    <Link href={`/admin/utilisateurs/${i.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{i.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{i.email}</p>
                    </Link>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">
                        {(i.payoutCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}{" "}
                        {i.currency}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Commission : {(i.platformFeeCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activité récente</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune activité ces 7 derniers jours.</p>
          ) : (
            <ul className="space-y-1">
              {activity.map((item) => (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/50"
                    >
                      <ActivityKindBadge kind={item.kind} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">
                          {item.title}
                        </span>
                        {item.subtitle ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </span>
                      <time
                        className="shrink-0 text-xs text-muted-foreground"
                        dateTime={item.createdAt.toISOString()}
                      >
                        {formatRelative(item.createdAt)}
                      </time>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-md px-2 py-2 text-sm">
                      <ActivityKindBadge kind={item.kind} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">
                          {item.title}
                        </span>
                        {item.subtitle ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </span>
                      <time
                        className="shrink-0 text-xs text-muted-foreground"
                        dateTime={item.createdAt.toISOString()}
                      >
                        {formatRelative(item.createdAt)}
                      </time>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityKindBadge({ kind }: { kind: "signup" | "order" | "course-published" | "audit" }) {
  if (kind === "signup") return <StatusBadge tone="info">Inscription</StatusBadge>;
  if (kind === "order") return <StatusBadge tone="success">Vente</StatusBadge>;
  if (kind === "course-published") return <StatusBadge tone="info">Publication</StatusBadge>;
  return <StatusBadge tone="neutral">Audit</StatusBadge>;
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

function computeDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}
