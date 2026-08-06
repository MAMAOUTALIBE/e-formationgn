import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BookOpenText,
  CheckCircle2,
  Coins,
  Megaphone,
  PiggyBank,
  Send,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";

import { CategoryDonut } from "@/components/features/admin/charts/category-donut";
import { RevenueChart } from "@/components/features/admin/charts/revenue-chart";
import { Sparkline } from "@/components/features/admin/charts/sparkline";
import { LiveActivityFeed } from "@/components/features/admin/live-activity-feed";
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
import { getFinanceHealthKpis } from "@/server/queries/admin-finances";

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

  const [kpis, timeseries, topCourses, topInstructors, byCategory, alerts, activity, financeHealth] =
    await Promise.all([
      getAdminOverviewKpis(range),
      getRevenueTimeseries(range),
      getTopCoursesByRevenue(range, 5),
      getTopInstructorsByRevenue(range, 5),
      getRevenueByCategory(range),
      getAdminAlerts(),
      getRecentActivity(20),
      getFinanceHealthKpis(range),
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
        <section className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-300" aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                Actions requises
              </p>
              <ul className="mt-2 grid gap-1.5 text-sm text-red-900 dark:text-red-100 sm:grid-cols-2">
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

      {/* 9 cartes : en 4 colonnes elles occupent 3 rangées dont une quasi vide.
          Une 5e colonne au-delà de xl les ramène à 2 rangées et rend une
          rangée entière au contenu sous-jacent. */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <KpiCard
          label="Revenu net plateforme"
          value={`${(financeHealth.netRevenueCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}
          delta={
            financeHealth.netRevenuePreviousCents > 0
              ? ((financeHealth.netRevenueCents - financeHealth.netRevenuePreviousCents) /
                  financeHealth.netRevenuePreviousCents) *
                100
              : null
          }
          icon={<PiggyBank className="h-4 w-4" />}
          hint="Gross − refunds (EUR)"
          href="/admin/finances"
        />
        <KpiCard
          label="Revenus EUR"
          value={`${(kpis.revenueByCurrency.EUR / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}
          delta={revenueDeltaEur}
          icon={<Coins className="h-4 w-4" />}
          hint="Période sélectionnée"
          sparkline={<Sparkline data={timeseries.map((p) => p.EUR)} color="#1E3A8A" />}
          href="/admin/analytics/revenus"
        />
        <KpiCard
          label="Revenus USD"
          value={`${(kpis.revenueByCurrency.USD / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} $`}
          delta={revenueDeltaUsd}
          icon={<Coins className="h-4 w-4" />}
          hint="Période sélectionnée"
          sparkline={<Sparkline data={timeseries.map((p) => p.USD)} color="#0EA5E9" />}
          href="/admin/analytics/revenus"
        />
        <KpiCard
          label="Commandes"
          value={kpis.ordersCount}
          icon={<ShoppingCart className="h-4 w-4" />}
          hint="Payées sur la période"
          href="/admin/finances/transactions"
        />
        <KpiCard
          label="Nouveaux inscrits"
          value={kpis.newSignups}
          icon={<Users className="h-4 w-4" />}
          hint="Comptes créés"
          href="/admin/utilisateurs"
        />
        <KpiCard
          label="Cours publiés"
          value={kpis.newCourses}
          icon={<BookOpenText className="h-4 w-4" />}
          hint="Sur la période"
          href="/admin/cours?status=PUBLISHED"
        />
        <KpiCard
          label="Élèves actifs"
          value={kpis.activeStudents30d}
          icon={<Activity className="h-4 w-4" />}
          hint="Au moins 1 leçon ces 30 j"
          href="/admin/analytics/apprentissage"
        />
        <KpiCard
          label="Complétion moyenne"
          value={`${kpis.averageCompletionPercent} %`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          hint="Inscriptions de la période"
          href="/admin/analytics/apprentissage"
        />
        <KpiCard
          label="En attente modération"
          value={kpis.pendingCoursesCount}
          icon={<TrendingUp className="h-4 w-4" />}
          hint="Cours à examiner"
          href="/admin/cours?status=PENDING_REVIEW"
        />
      </section>

      {/* Quick actions — accès rapide aux opérations courantes (pattern Stripe) */}
      <section
        aria-labelledby="quick-actions-heading"
        className="rounded-lg border border-border bg-card p-4"
      >
        <h2
          id="quick-actions-heading"
          className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Actions rapides
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            href="/admin/cours?status=PENDING_REVIEW"
            icon={<TrendingUp className="h-4 w-4" />}
            label="Modérer les cours en attente"
            count={kpis.pendingCoursesCount}
          />
          <QuickAction
            href="/admin/finances/payouts?status=PENDING"
            icon={<Send className="h-4 w-4" />}
            label="Payouts en attente"
            count={undefined}
          />
          <QuickAction
            href="/admin/support/litiges"
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Litiges / chargebacks"
            count={financeHealth.chargebackCount}
          />
          <QuickAction
            href="/admin/marketing/campagnes-email"
            icon={<Megaphone className="h-4 w-4" />}
            label="Campagnes email"
          />
        </div>
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
                  <li key={c.categoryId}>
                    <Link
                      href={`/admin/cours?categoryId=${c.categoryId}`}
                      className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    >
                      <span className="truncate">{c.categoryName}</span>
                      <span className="font-medium text-foreground">
                        {(c.revenueCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                      </span>
                    </Link>
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

      <LiveActivityFeed />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activité récente (7 derniers jours)</CardTitle>
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

function QuickAction({
  href,
  icon,
  label,
  count,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-md border border-border bg-background p-3 text-sm transition-colors hover:border-[color:var(--brand-secondary)] hover:bg-muted/50"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-[color:var(--brand-secondary)]/10 group-hover:text-[color:var(--brand-secondary)]">
        {icon}
      </div>
      <span className="min-w-0 flex-1 font-medium text-foreground">{label}</span>
      {typeof count === "number" && count > 0 ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--brand-warning)] px-1.5 text-[10px] font-bold text-white">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
