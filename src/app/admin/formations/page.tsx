import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  FolderOpen,
  GraduationCap,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButton } from "@/components/ui/export-button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { exportProgramsCsv } from "@/server/actions/admin-crm-exports";
import {
  getProgramsDashboardStats,
  listPrograms,
  type ProgramListRow,
} from "@/server/queries/admin-programs";

export const metadata: Metadata = { title: "Programmes de formation — CRM admin" };
export const dynamic = "force-dynamic";

interface Params {
  q?: string;
  statut?: string;
  duree?: string;
  page?: string;
}
const PAGE_SIZE = 25;

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const [allRows, stats] = await Promise.all([
    listPrograms({
      search: params.q,
      status: params.statut,
      duration: params.duree,
    }),
    getProgramsDashboardStats(),
  ]);
  const rows = allRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  const hasFilters = Boolean(params.q || params.statut || params.duree);

  return (
    <div className="space-y-5" data-testid="programs-workspace">
      <div className="text-xs text-muted-foreground">
        <Link href="/admin" className="hover:text-foreground">
          CRM
        </Link>
        <span className="px-2">/</span>
        <span className="font-medium text-foreground">
          Programmes de formation
        </span>
      </div>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Programmes de formation
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Programmes pédagogiques, sessions et inscriptions centralisés.
            </p>
          </div>
        </div>
        <div className="grid w-full gap-2 sm:flex sm:w-auto [&>div]:w-full [&_button]:w-full">
          <ExportButton action={exportProgramsCsv} />
          <Button asChild>
            <Link href="/admin/formations/nouvelle">
              <Plus className="h-4 w-4" />
              Nouveau programme
            </Link>
          </Button>
        </div>
      </header>

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Statistiques des programmes de formation"
      >
        <KpiCard
          label="Total programmes"
          value={stats.total}
          icon={<FolderOpen className="h-5 w-5" />}
          tone="blue"
          hint={`${stats.draft} brouillon${stats.draft > 1 ? "s" : ""}`}
          appearance="crm"
        />
        <KpiCard
          label="Programmes actifs"
          value={stats.active}
          icon={<GraduationCap className="h-5 w-5" />}
          tone="emerald"
          hint={
            stats.total
              ? `${Math.round((stats.active / stats.total) * 100)} % du catalogue`
              : "Catalogue vide"
          }
          href="/admin/formations?statut=ACTIVE"
          appearance="crm"
        />
        <KpiCard
          label="Sessions à venir"
          value={stats.upcomingSessions}
          icon={<CalendarDays className="h-5 w-5" />}
          tone="amber"
          hint="Planifiées ou en cours"
          appearance="crm"
        />
        <KpiCard
          label="Élèves inscrits"
          value={stats.registrations}
          icon={<UsersRound className="h-5 w-5" />}
          tone="sky"
          hint="Inscriptions aux sessions"
          appearance="crm"
        />
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border/75 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
          <form
            className="grid gap-3 border-b border-border/70 p-4 sm:grid-cols-2 2xl:grid-cols-[minmax(16rem,1fr)_12rem_12rem_auto]"
            role="search"
          >
            <div className="relative sm:col-span-2 2xl:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                aria-label="Rechercher un programme"
                defaultValue={params.q ?? ""}
                placeholder="Intitulé, code, description…"
                className="pl-9"
              />
            </div>
            <Select
              name="statut"
              aria-label="Statut"
              defaultValue={params.statut ?? ""}
            >
              <option value="">Tous les statuts</option>
              <option value="ACTIVE">Actives</option>
              <option value="DRAFT">Brouillons</option>
              <option value="ARCHIVED">Archivées</option>
            </Select>
            <Select
              name="duree"
              aria-label="Durée"
              defaultValue={params.duree ?? ""}
            >
              <option value="">Toutes les durées</option>
              <option value="short">Moins de 40 h</option>
              <option value="medium">40 à 100 h</option>
              <option value="long">Plus de 100 h</option>
            </Select>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                <SlidersHorizontal className="h-4 w-4" />
                Filtrer
              </Button>
              {hasFilters ? (
                <Button variant="outline" size="icon" asChild>
                  <Link href="/admin/formations" aria-label="Réinitialiser">
                    <RotateCcw className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </form>
          {rows.length ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <ProgramsTable rows={rows} />
              </div>
              <div className="divide-y divide-border/60 md:hidden">
                {rows.map((program) => (
                  <ProgramMobileCard key={program.id} program={program} />
                ))}
              </div>
            </>
          ) : (
            <div className="p-5">
              <EmptyState
                icon={<GraduationCap className="h-6 w-6" />}
                title="Aucun programme trouvé"
                description={
                  hasFilters
                    ? "Modifiez ou réinitialisez les filtres."
                    : "Créez un premier programme pour organiser les formations et sessions."
                }
                action={
                  <Button asChild>
                    <Link href="/admin/formations/nouvelle">
                      Créer un programme
                    </Link>
                  </Button>
                }
              />
            </div>
          )}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
            <span>
              {allRows.length
                ? `Affichage de ${(page - 1) * PAGE_SIZE + 1} à ${Math.min(page * PAGE_SIZE, allRows.length)} sur ${allRows.length} programme${allRows.length > 1 ? "s" : ""}`
                : "Aucun résultat"}
            </span>
            {totalPages > 1 ? (
              <Pagination params={params} page={page} totalPages={totalPages} />
            ) : null}
          </footer>
        </section>
        <ProgramsSidebar stats={stats} />
      </div>
    </div>
  );
}

function ProgramsTable({ rows }: { rows: ProgramListRow[] }) {
  return (
    <table className="w-full min-w-[54rem] text-sm">
      <thead className="border-b border-border bg-muted/35 text-left text-[10px] uppercase tracking-[.08em] text-muted-foreground">
        <tr>
          <th className="px-4 py-3">Programme</th>
          <th className="px-4 py-3">Code</th>
          <th className="px-4 py-3 text-right">Durée</th>
          <th className="px-4 py-3">Statut</th>
          <th className="px-4 py-3 text-right">Sessions</th>
          <th className="px-4 py-3 text-right">Élèves</th>
          <th className="px-4 py-3 text-right">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/60">
        {rows.map((program) => (
          <tr key={program.id} className="hover:bg-muted/35">
            <td className="px-4 py-3">
              <div className="flex items-center gap-3">
                <ProgramIcon title={program.title} />
                <div>
                  <Link
                    href={`/admin/formations/${program.id}`}
                    className="font-semibold hover:underline"
                  >
                    {program.title}
                  </Link>
                  <p className="text-[10px] text-muted-foreground">
                    {program.courseCount} formation{program.courseCount !== 1 ? "s" : ""} dans le parcours
                  </p>
                </div>
              </div>
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {program.code ?? "—"}
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              {program.durationHours ? `${program.durationHours} h` : "—"}
            </td>
            <td className="px-4 py-3">
              <ProgramStatus status={program.status} />
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              <strong>{program.sessionCount}</strong>
              {program.upcomingSessionCount ? (
                <span className="block text-[10px] text-muted-foreground">
                  {program.upcomingSessionCount} à venir
                </span>
              ) : null}
            </td>
            <td className="px-4 py-3 text-right font-semibold tabular-nums">
              {program.registrationCount}
            </td>
            <td className="px-4 py-3 text-right">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/admin/formations/${program.id}`}>Voir</Link>
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function ProgramMobileCard({ program }: { program: ProgramListRow }) {
  return (
    <Link
      href={`/admin/formations/${program.id}`}
      className="block p-4 hover:bg-muted/35"
    >
      <div className="flex gap-3">
        <ProgramIcon title={program.title} />
        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-2">
            <h2 className="truncate font-semibold">{program.title}</h2>
            <ProgramStatus status={program.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {program.code ?? "Sans code"} ·{" "}
            {program.durationHours
              ? `${program.durationHours} h`
              : "Durée non définie"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {program.sessionCount} sessions · {program.registrationCount} élèves
          </p>
        </div>
      </div>
    </Link>
  );
}
function ProgramsSidebar({
  stats,
}: {
  stats: Awaited<ReturnType<typeof getProgramsDashboardStats>>;
}) {
  const actions = [
    {
      href: "/admin/formations/nouvelle",
      icon: Plus,
      title: "Nouveau programme",
      text: "Créer un programme",
    },
    {
      href: "/admin/formations",
      icon: CalendarDays,
      title: "Gérer les sessions",
      text: "Planifier depuis un programme",
    },
    {
      href: "/admin/cours",
      icon: BookOpen,
      title: "Gérer les formations",
      text: "Composer les parcours",
    },
    {
      href: "/admin/categories",
      icon: FolderOpen,
      title: "Catégories",
      text: "Organiser le catalogue",
    },
    {
      href: "/admin/analytics/apprentissage",
      icon: BarChart3,
      title: "Statistiques",
      text: "Analyser les performances",
    },
  ];
  return (
    <aside className="space-y-4 xl:sticky xl:top-4">
      <div className="rounded-2xl border border-border/75 bg-card p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        <h2 className="font-semibold">Actions rapides</h2>
        <div className="mt-3 divide-y divide-border/60">
          {actions.map(({ href, icon: Icon, title, text }) => (
            <Link
              key={title}
              href={href}
              className="group flex items-center gap-3 py-3"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold group-hover:underline">
                  {title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {text}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-border/75 bg-card p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        <h2 className="font-semibold">Répartition des statuts</h2>
        <div className="mt-4 flex items-center gap-5">
          <StatusDonut stats={stats} />
          <ul className="flex-1 space-y-2 text-xs">
            <Legend
              color="bg-emerald-500"
              label="Actives"
              value={stats.active}
            />
            <Legend
              color="bg-amber-500"
              label="Brouillons"
              value={stats.draft}
            />
            <Legend
              color="bg-slate-400"
              label="Archivées"
              value={stats.archived}
            />
          </ul>
        </div>
      </div>
    </aside>
  );
}
function StatusDonut({
  stats,
}: {
  stats: Awaited<ReturnType<typeof getProgramsDashboardStats>>;
}) {
  const total = Math.max(stats.total, 1);
  const active = (stats.active / total) * 100;
  const draft = (stats.draft / total) * 100;
  return (
    <div
      className="relative h-24 w-24 shrink-0 rounded-full"
      style={{
        background: `conic-gradient(#10b981 0 ${active}%, #f59e0b ${active}% ${active + draft}%, #94a3b8 ${active + draft}% 100%)`,
      }}
      role="img"
      aria-label={`${stats.active} programmes actifs sur ${stats.total}`}
    >
      <span className="absolute inset-[14px] flex items-center justify-center rounded-full bg-card text-xs font-bold">
        {Math.round(active)}%
      </span>
    </div>
  );
}
function Legend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        {label}
      </span>
      <strong>{value}</strong>
    </li>
  );
}
function ProgramIcon({ title }: { title: string }) {
  const Icon = title.length % 2 ? BookOpen : GraduationCap;
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-emerald-50 text-blue-700 dark:from-blue-500/10 dark:to-emerald-500/10 dark:text-blue-300">
      <Icon className="h-4 w-4" />
    </span>
  );
}
function ProgramStatus({ status }: { status: string }) {
  return status === "ACTIVE" ? (
    <StatusBadge tone="success">Active</StatusBadge>
  ) : status === "DRAFT" ? (
    <StatusBadge tone="warning">Brouillon</StatusBadge>
  ) : (
    <StatusBadge tone="neutral">Archivée</StatusBadge>
  );
}
function Pagination({
  params,
  page,
  totalPages,
}: {
  params: Params;
  page: number;
  totalPages: number;
}) {
  const href = (next: number) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.statut) search.set("statut", params.statut);
    if (params.duree) search.set("duree", params.duree);
    search.set("page", String(next));
    return `/admin/formations?${search}`;
  };
  return (
    <nav
      className="flex items-center gap-1"
      aria-label="Pagination des programmes"
    >
      <Button
        size="icon"
        variant="outline"
        className="h-8 w-8"
        asChild={page > 1}
        disabled={page <= 1}
      >
        {page > 1 ? (
          <Link href={href(page - 1)}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        ) : (
          <ArrowLeft className="h-4 w-4" />
        )}
      </Button>
      <strong className="px-2 text-foreground">
        {page} / {totalPages}
      </strong>
      <Button
        size="icon"
        variant="outline"
        className="h-8 w-8"
        asChild={page < totalPages}
        disabled={page >= totalPages}
      >
        {page < totalPages ? (
          <Link href={href(page + 1)}>
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
      </Button>
    </nav>
  );
}
