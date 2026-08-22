import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Building2, CalendarPlus, RotateCcw, Search, SlidersHorizontal, UsersRound } from "lucide-react";

import { LearnerHeaderActions } from "@/components/features/admin/learner-header-actions";
import { LearnersTable } from "@/components/features/admin/learners-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AccountStatus } from "@/generated/prisma/enums";
import { parseListFilter } from "@/lib/admin/list-filters";
import { isTrainingCenterMode } from "@/lib/platform-mode";
import { prisma } from "@/lib/prisma";
import { listSelectableCompanies } from "@/server/queries/admin-companies";
import { ADMIN_USERS_SORTS, getAdminUsersDashboardStats, listAdminUsers, listUserCountries } from "@/server/queries/admin-users";

export const metadata: Metadata = { title: "Apprenants — CRM admin" };
export const dynamic = "force-dynamic";

interface UserSearchParams {
  // Volontairement typés `string` : ce qui arrive de l'URL n'est pas encore
  // une valeur d'énumération, c'est une chaîne à valider. Les annoter
  // `AccountStatus` faisait croire au contraire, et une valeur inconnue
  // partait telle quelle vers Prisma — qui répondait par une erreur, donc
  // une page 500, là où un filtre incompris doit simplement être ignoré.
  q?: string; companyId?: string; status?: string;
  country?: string; page?: string; pageSize?: string; sort?: string; direction?: string;
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<UserSearchParams> }) {
  const params = await searchParams;
  const trainingCenter = isTrainingCenterMode();
  const pageSize = [25, 50, 100].includes(Number(params.pageSize)) ? Number(params.pageSize) : 50;
  const status = parseListFilter(params.status, Object.values(AccountStatus));
  const filters = {
    q: params.q,
    companyId: params.companyId,
    status,
    country: params.country,
    page: Number(params.page) || 1,
    pageSize,
    sort: parseListFilter(params.sort, ADMIN_USERS_SORTS),
    direction: parseListFilter(params.direction, ["asc", "desc"] as const),
  };
  const [{ rows, total, page }, companies, countries, stats, publishedCourses] = await Promise.all([
    listAdminUsers(filters),
    listSelectableCompanies(),
    listUserCountries(),
    getAdminUsersDashboardStats(),
    prisma.course.findMany({ where: { status: "PUBLISHED" }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(filters.q || filters.companyId || filters.status || filters.country);

  return <div className="flex h-full max-h-[calc(100dvh-12.5rem)] min-h-0 flex-col gap-3 overflow-hidden" data-testid="learners-workspace">
    <header className="flex shrink-0 items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300"><UsersRound className="h-5 w-5" /></span><div className="flex min-w-0 items-baseline gap-3"><h1 className="truncate text-2xl font-semibold tracking-tight">Gestion des apprenants</h1><span className="whitespace-nowrap text-sm text-muted-foreground">{stats.total.toLocaleString("fr-FR")} élèves</span></div></div>
      <LearnerHeaderActions companies={companies} courses={publishedCourses} trainingCenter={trainingCenter} />
    </header>

    <section className="grid shrink-0 grid-cols-2 overflow-hidden rounded-xl border border-border/75 bg-card shadow-sm sm:grid-cols-4" aria-label="Statistiques des apprenants">
      <CompactStat icon={<UsersRound className="h-4 w-4" />} label="Total apprenants" value={stats.total} tone="bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" />
      <CompactStat icon={<Building2 className="h-4 w-4" />} label="Rattachés" value={stats.withCompany} tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" />
      <CompactStat icon={<CalendarPlus className="h-4 w-4" />} label="Nouveaux inscrits" value={stats.createdLast30Days} tone="bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" />
      <CompactStat icon={<BadgeCheck className="h-4 w-4" />} label="Comptes actifs" value={stats.active} tone="bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" />
      {stats.deleted > 0 ? <Link href="/admin/utilisateurs?status=DELETED" className="self-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">{stats.deleted} compte{stats.deleted > 1 ? "s" : ""} archivé{stats.deleted > 1 ? "s" : ""}</Link> : null}
    </section>

    <UserFilters params={params} companies={companies} countries={countries} hasFilters={hasFilters} />

    {rows.length ? <LearnersTable rows={rows} params={params as Record<string, string | undefined>} page={page} pageSize={pageSize} total={total} totalPages={totalPages} companies={companies} courses={publishedCourses} /> : <section className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-border/75 bg-card"><EmptyState icon={<UsersRound className="h-6 w-6" />} title="Aucun compte trouvé" description={hasFilters ? "Modifiez ou réinitialisez les filtres pour élargir la recherche." : "Créez un premier compte apprenant pour commencer."} action={hasFilters ? <Button asChild variant="outline"><Link href="/admin/utilisateurs">Réinitialiser les filtres</Link></Button> : undefined} /></section>}
  </div>;
}

function CompactStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) { return <div className="flex min-h-16 items-center gap-3 border-r border-border/70 px-4 last:border-r-0"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>{icon}</span><div className="min-w-0"><p className="truncate text-xs text-muted-foreground">{label}</p><strong className="text-lg tabular-nums">{value.toLocaleString("fr-FR")}</strong></div></div>; }

function UserFilters({ params, companies, countries, hasFilters }: { params: UserSearchParams; companies: Array<{ id: string; name: string }>; countries: Array<{ country: string; count: number }>; hasFilters: boolean }) {
  return <form className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-border/75 bg-card p-2.5 shadow-sm 2xl:flex-nowrap" role="search"><div className="relative min-w-64 flex-[2_1_20rem]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input name="q" aria-label="Rechercher par nom, prénom ou e-mail" defaultValue={params.q ?? ""} placeholder="Nom, prénom ou e-mail…" className="h-9 pl-9" /></div><Select name="companyId" defaultValue={params.companyId ?? ""} aria-label="Société" className="h-9 min-w-36 flex-1 py-1"><option value="">Société · Toutes</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</Select><Select name="status" defaultValue={status ?? ""} aria-label="Statut" className="h-9 min-w-32 flex-1 py-1"><option value="">Statut · Actifs et suspendus</option><option value="ACTIVE">Actifs</option><option value="PENDING_VERIFICATION">En attente</option><option value="SUSPENDED">Suspendus</option><option value="DELETED">Archivés</option></Select><Select name="country" defaultValue={params.country ?? ""} aria-label="Pays" className="h-9 min-w-32 flex-1 py-1"><option value="">Pays · Tous</option>{countries.map(({ country }) => <option key={country} value={country}>{country}</option>)}</Select><Button type="submit" variant="outline" size="sm" className="h-9"><SlidersHorizontal className="h-4 w-4" />Filtres</Button>{hasFilters ? <Button asChild variant="ghost" size="icon" className="h-9 w-9"><Link href="/admin/utilisateurs" aria-label="Réinitialiser les filtres" title="Réinitialiser"><RotateCcw className="h-4 w-4" /></Link></Button> : null}</form>;
}
