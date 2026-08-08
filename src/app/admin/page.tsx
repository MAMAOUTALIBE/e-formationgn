import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  ShoppingCart,
  Users,
} from "lucide-react";

import { auth } from "@/auth";
import { AdminActionQueueCard } from "@/components/features/admin/admin-action-queue";
import {
  AdminDashboardTabs,
  DEFAULT_DASHBOARD_VIEW,
  isDashboardView,
  type DashboardView,
} from "@/components/features/admin/admin-dashboard-tabs";
import { CategoryDonut } from "@/components/features/admin/charts/category-donut";
import { RevenueChart } from "@/components/features/admin/charts/revenue-chart";
import { LiveActivityFeed } from "@/components/features/admin/live-activity-feed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { PeriodSegments } from "@/components/ui/period-segments";
import { periodToRange } from "@/lib/admin/period";
import { readPeriod } from "@/lib/admin/period-server";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAdminActionQueue } from "@/server/queries/admin-action-queue";
import {
  getAdminAlerts,
  getAdminOverviewKpis,
  getCrmDashboardSnapshot,
  getRecentActivity,
  getRevenueByCategory,
  getRevenueTimeseries,
  getTopCoursesByRevenue,
  getTopInstructorsByRevenue,
} from "@/server/queries/admin-overview";
import type { ActivityItem, CrmDashboardSnapshot } from "@/server/queries/admin-overview";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tableau de bord — CRM admin",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ period?: string; vue?: string }>;
}

export default async function AdminOverviewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = await readPeriod(params.period ?? null);
  const range = periodToRange(period);
  const view: DashboardView =
    params.vue && isDashboardView(params.vue) ? params.vue : DEFAULT_DASHBOARD_VIEW;

  const session = await auth();
  const firstName = session?.user?.name?.trim().split(/\s+/)[0] ?? "";
  const today = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Bonjour {firstName || "à vous"} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {/* Séparateur explicite : en JSX, l'espace entre l'expression et
                le texte suivant se perd au rendu (« 2026· Vue »). */}
            {capitalize(today)}
            {" · "}
            Vue d&apos;ensemble de l&apos;activité de la plateforme.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSegments />
          <DateRangePicker />
        </div>
      </header>

      <AdminDashboardTabs current={view} period={params.period ?? null} />

      {/* Chaque onglet ne déclenche que ses propres requêtes : ouvrir
          « Pilotage » ne paie plus les agrégats des graphiques ni le flux
          d'activité, qui représentaient l'essentiel du temps de chargement. */}
      {view === "pilotage" ? <PilotageView range={range} /> : null}
      {view === "analyse" ? <AnalyseView range={range} /> : null}
      {view === "activite" ? <ActiviteView /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pilotage — ce qu'il faut regarder et faire aujourd'hui
// ---------------------------------------------------------------------------

async function PilotageView({ range }: { range: { from: Date; to: Date } }) {
  const [kpis, timeseries, alerts, queue, crm, byCategory, activity] = await Promise.all([
    getAdminOverviewKpis(range),
    getRevenueTimeseries(range),
    getAdminAlerts(),
    getAdminActionQueue(5),
    getCrmDashboardSnapshot(range),
    getRevenueByCategory(range),
    getRecentActivity(6),
  ]);

  const revenueDeltaEur = computeDelta(
    kpis.revenueByCurrency.EUR,
    kpis.revenuePreviousByCurrency.EUR,
  );
  const registrationDelta = computeDelta(
    crm.registrationRatePercent,
    crm.previousRegistrationRatePercent,
  );

  return (
    <div className="space-y-5" data-testid="crm-dashboard">
      {alerts.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-300"
              aria-hidden
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                Points d&apos;attention
              </p>
              <ul className="mt-1.5 grid gap-1 text-sm text-amber-900 dark:text-amber-100 sm:grid-cols-2 xl:grid-cols-3">
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

      <section aria-label="Indicateurs stratégiques" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Nouvelles inscriptions"
          value={crm.registrationsCount}
          icon={<Users className="h-5 w-5" />}
          tone="blue"
          hint="sur la période sélectionnée"
          href="/admin/utilisateurs"
          appearance="crm"
        />
        <KpiCard
          label="Sessions planifiées"
          value={crm.plannedSessions}
          icon={<CalendarDays className="h-5 w-5" />}
          tone="emerald"
          hint={`${crm.activePrograms} formation${crm.activePrograms > 1 ? "s" : ""} active${crm.activePrograms > 1 ? "s" : ""}`}
          href="/admin/formations"
          appearance="crm"
        />
        <KpiCard
          label="Taux d'inscription"
          value={`${crm.registrationRatePercent.toLocaleString("fr-FR")} %`}
          delta={registrationDelta}
          icon={<ClipboardCheck className="h-5 w-5" />}
          tone="sky"
          hint="places réservées"
          href="/admin/analytics/funnel"
          appearance="crm"
        />
        <KpiCard
          label="Chiffre d'affaires"
          value={`${(kpis.revenueByCurrency.EUR / 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`}
          delta={revenueDeltaEur}
          icon={<CreditCard className="h-5 w-5" />}
          tone="amber"
          hint="commandes payées en EUR"
          href="/admin/finances"
          appearance="crm"
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        <DashboardPanel className="xl:col-span-6" title="Évolution du chiffre d'affaires" href="/admin/analytics/revenus">
          <RevenueChart data={timeseries} />
        </DashboardPanel>
        <DashboardPanel className="xl:col-span-3" title="Revenus par formation" href="/admin/analytics">
          <CategoryDonut data={byCategory.slice(0, 6)} />
          <CategoryLegend data={byCategory.slice(0, 5)} />
        </DashboardPanel>
        <DashboardPanel className="xl:col-span-3" title="Sessions à venir" href="/admin/formations">
          <UpcomingSessions sessions={crm.upcomingSessions} />
        </DashboardPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <DashboardPanel className="xl:col-span-6" title="Inscriptions récentes" href="/admin/utilisateurs">
          <RecentRegistrations registrations={crm.recentRegistrations} />
        </DashboardPanel>
        <section className="xl:col-span-3"><AdminActionQueueCard queue={queue} /></section>
        <DashboardPanel className="xl:col-span-3" title="Activité récente" href="/admin?vue=activite">
          <RecentActivity activity={activity} />
        </DashboardPanel>
      </div>

      <section aria-label="Indicateurs complémentaires" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CompactMetric label="Comptes créés" value={kpis.newSignups} icon={<Users />} href="/admin/utilisateurs" />
        <CompactMetric label="Élèves actifs" value={kpis.activeStudents30d} icon={<Activity />} href="/admin/analytics/apprentissage" />
        <CompactMetric label="Paiements reçus" value={kpis.ordersCount} icon={<ShoppingCart />} href="/admin/finances/transactions" />
        <CompactMetric label="Inscriptions à valider" value={crm.pendingRegistrations} icon={<GraduationCap />} href="/admin/formations" />
      </section>
    </div>
  );
}

function DashboardPanel({
  title,
  href,
  className,
  children,
}: {
  title: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border border-border/75 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03),0_12px_32px_rgba(15,23,42,0.045)]",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3.5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{title}</h2>
        <Link href={href} className="shrink-0 text-xs font-semibold text-[color:var(--brand-primary)] hover:underline">
          Voir tout
        </Link>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

// Même ordre que le donut client afin que chaque légende conserve sa couleur.
const CATEGORY_COLORS = ["#1E3A8A", "#7c3aed", "#0EA5E9", "#10b981", "#f59e0b"];

function CategoryLegend({ data }: { data: Array<{ categoryId: string; categoryName: string; revenueCents: number }> }) {
  const total = data.reduce((sum, row) => sum + row.revenueCents, 0);
  if (total === 0) return null;
  return (
    <ul className="space-y-2 border-t border-border/60 pt-3">
      {data.map((row, index) => (
        <li key={row.categoryId} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.categoryName}</span>
          <span className="font-semibold text-foreground">{Math.round((row.revenueCents / total) * 100)} %</span>
        </li>
      ))}
    </ul>
  );
}

function UpcomingSessions({ sessions }: { sessions: CrmDashboardSnapshot["upcomingSessions"] }) {
  if (sessions.length === 0) return <EmptyDashboardState label="Aucune session planifiée." />;
  return (
    <ul className="divide-y divide-border/60">
      {sessions.map((session) => {
        const remaining = session.capacity === null ? null : Math.max(session.capacity - session.registrationsCount, 0);
        return (
          <li key={session.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <time dateTime={session.startDate.toISOString()} className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              <span className="text-base font-bold leading-none">{session.startDate.getDate()}</span>
              <span className="mt-0.5 text-[9px] font-bold uppercase">{new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(session.startDate)}</span>
            </time>
            <div className="min-w-0 flex-1">
              <Link href={`/admin/formations?session=${session.id}`} className="block truncate text-sm font-semibold hover:underline">{session.title}</Link>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{session.location ?? session.reference ?? "Lieu à préciser"}</p>
            </div>
            {remaining !== null ? <span className="h-fit shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{remaining} place{remaining > 1 ? "s" : ""}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

const REGISTRATION_STATUS = {
  PENDING: ["En attente", "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"],
  ACTIVE: ["Active", "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"],
  SUSPENDED: ["Suspendue", "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"],
  COMPLETED: ["Terminée", "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"],
  CANCELLED: ["Annulée", "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"],
} as const;

function RecentRegistrations({ registrations }: { registrations: CrmDashboardSnapshot["recentRegistrations"] }) {
  if (registrations.length === 0) return <EmptyDashboardState label="Aucune inscription récente." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] text-left text-xs">
        <thead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <tr><th className="pb-3">Apprenant</th><th className="pb-3">Formation</th><th className="pb-3">Session</th><th className="pb-3">Statut</th><th className="pb-3 text-right">Date</th></tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {registrations.map((registration) => {
            const [label, tone] = REGISTRATION_STATUS[registration.status];
            return (
              <tr key={registration.id}>
                <td className="py-2.5 pr-4"><Link href={`/admin/utilisateurs/${registration.studentId}`} className="font-semibold text-foreground hover:underline">{registration.studentName}</Link><span className="block max-w-40 truncate text-[10px] text-muted-foreground">{registration.studentEmail}</span></td>
                <td className="max-w-48 truncate py-2.5 pr-4 font-medium">{registration.programTitle}</td>
                <td className="py-2.5 pr-4 text-muted-foreground">{registration.sessionReference ?? "—"}</td>
                <td className="py-2.5 pr-4"><span className={cn("rounded-full px-2 py-1 font-semibold", tone)}>{label}</span></td>
                <td className="whitespace-nowrap py-2.5 text-right text-muted-foreground">{new Intl.DateTimeFormat("fr-FR").format(registration.registeredAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecentActivity({ activity }: { activity: ActivityItem[] }) {
  if (activity.length === 0) return <EmptyDashboardState label="Aucune activité récente." />;
  return (
    <ul className="space-y-1">
      {activity.map((item) => (
        <li key={item.id}>
          <Link href={item.href ?? "/admin?vue=activite"} className="group flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-muted/50">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[color:var(--brand-primary)] ring-4 ring-[color:var(--brand-primary)]/10" aria-hidden />
            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-foreground">{item.title}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{item.subtitle ?? "Gandal"} · {formatRelative(item.createdAt)}</span></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CompactMetric({ label, value, icon, href }: { label: string; value: number; icon: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--brand-primary)]/8 text-[color:var(--brand-primary)] [&_svg]:h-4 [&_svg]:w-4" aria-hidden>{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-xl font-bold tracking-tight">{value.toLocaleString("fr-FR")}</span><span className="block truncate text-xs text-muted-foreground">{label}</span></span>
    </Link>
  );
}

function EmptyDashboardState({ label }: { label: string }) {
  return <p className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border px-4 text-center text-sm text-muted-foreground">{label}</p>;
}

// ---------------------------------------------------------------------------
// Analyse — graphiques et classements
// ---------------------------------------------------------------------------

async function AnalyseView({ range }: { range: { from: Date; to: Date } }) {
  const [timeseries, byCategory, topCourses, topInstructors] = await Promise.all([
    getRevenueTimeseries(range),
    getRevenueByCategory(range),
    getTopCoursesByRevenue(range, 5),
    getTopInstructorsByRevenue(range, 5),
  ]);

  return (
    <div className="space-y-6">
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activité — flux temps réel et historique récent
// ---------------------------------------------------------------------------

async function ActiviteView() {
  const activity = await getRecentActivity(20);

  return (
    <div className="space-y-6">
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

// ---------------------------------------------------------------------------

function ActivityKindBadge({ kind }: { kind: "signup" | "order" | "course-published" | "audit" }) {
  if (kind === "signup") return <StatusBadge tone="info">Inscription</StatusBadge>;
  if (kind === "order") return <StatusBadge tone="success">Vente</StatusBadge>;
  if (kind === "course-published") return <StatusBadge tone="info">Publication</StatusBadge>;
  return <StatusBadge tone="neutral">Audit</StatusBadge>;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
