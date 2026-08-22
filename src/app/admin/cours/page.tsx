import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CheckCircle2, Clock3, FilePenLine, Plus, RotateCcw, Search, SlidersHorizontal, UsersRound } from "lucide-react";

import { AdminCoursesTable } from "@/components/features/admin/courses-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CourseStatus } from "@/generated/prisma/enums";
import { parseListFilter } from "@/lib/admin/list-filters";
import { ADMIN_COURSES_SORTS, getAdminCoursesDashboardData, listAdminCourses } from "@/server/queries/admin-courses";
import { listFeaturedCategories } from "@/server/queries/categories";

export const metadata: Metadata = { title: "Formations — CRM admin" };
export const dynamic = "force-dynamic";

interface Params {
  // Chaînes brutes : ce qui vient de l'URL se valide avant d'atteindre
  // Prisma. Un statut inconnu doit être ignoré, pas provoquer une erreur
  // d'énumération et donc une page en échec.
  q?: string;
  status?: string;
  categoryId?: string;
  instructorId?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
  direction?: string;
}

export default async function AdminCoursesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const pageSize = [25, 50, 100].includes(Number(params.pageSize)) ? Number(params.pageSize) : 50;
  const status = parseListFilter(params.status, Object.values(CourseStatus));
  const filters = {
    q: params.q,
    status,
    categoryId: params.categoryId,
    instructorId: params.instructorId,
    page: Number(params.page) || 1,
    pageSize,
    sort: parseListFilter(params.sort, ADMIN_COURSES_SORTS),
    direction: parseListFilter(params.direction, ["asc", "desc"] as const),
  };
  const [{ rows, total, page }, categories, dashboard] = await Promise.all([
    listAdminCourses(filters),
    listFeaturedCategories(100),
    getAdminCoursesDashboardData(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(filters.q || filters.status || filters.categoryId || filters.instructorId);

  return (
    <div className="flex h-full max-h-[calc(100dvh-12.5rem)] min-h-0 flex-col gap-3 overflow-hidden" data-testid="courses-workspace">
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300"><BookOpen className="h-5 w-5" /></span>
          <div className="flex min-w-0 items-baseline gap-3"><h1 className="text-2xl font-semibold tracking-tight">Formations</h1><span className="whitespace-nowrap text-sm text-muted-foreground">{dashboard.stats.total} formation{dashboard.stats.total !== 1 ? "s" : ""}</span></div>
        </div>
        <Button asChild><Link href="/formateur/cours/nouveau"><Plus className="h-4 w-4" />Créer une formation</Link></Button>
      </header>

      <section className="grid shrink-0 grid-cols-2 overflow-hidden rounded-xl border border-border/75 bg-card shadow-sm sm:grid-cols-3 lg:grid-cols-5" aria-label="Statistiques des formations">
        <CompactStat icon={<BookOpen className="h-4 w-4" />} label="Total des formations" value={dashboard.stats.total} tone="text-blue-700 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-300" />
        <CompactStat icon={<CheckCircle2 className="h-4 w-4" />} label="Publiés" value={dashboard.stats.published} tone="text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300" />
        <CompactStat icon={<FilePenLine className="h-4 w-4" />} label="Brouillons" value={dashboard.stats.draft} tone="text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300" />
        <CompactStat icon={<Clock3 className="h-4 w-4" />} label="À modérer" value={dashboard.stats.pending} tone="text-violet-700 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-300" />
        <CompactStat icon={<UsersRound className="h-4 w-4" />} label="Élèves inscrits" value={dashboard.stats.enrollments} tone="text-sky-700 bg-sky-50 dark:bg-sky-500/10 dark:text-sky-300" />
      </section>

      <CourseFilters params={params} categories={categories} instructors={dashboard.instructors} hasFilters={hasFilters} />

      {rows.length ? (
        <AdminCoursesTable rows={rows} params={params as Record<string, string | undefined>} page={page} pageSize={pageSize} total={total} totalPages={totalPages} />
      ) : (
        <section className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-border/75 bg-card">
          <EmptyState icon={<BookOpen className="h-6 w-6" />} title="Aucune formation trouvée" description={hasFilters ? "Modifiez ou réinitialisez les filtres pour élargir la recherche." : "Aucune formation n’est encore disponible dans le catalogue."} action={hasFilters ? <Button asChild variant="outline"><Link href="/admin/cours">Réinitialiser les filtres</Link></Button> : <Button asChild><Link href="/formateur/cours/nouveau">Créer une formation</Link></Button>} />
        </section>
      )}
    </div>
  );
}

function CompactStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return <div className="flex min-h-16 items-center gap-3 border-r border-border/70 px-4 last:border-r-0"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>{icon}</span><div className="min-w-0"><p className="truncate text-xs text-muted-foreground">{label}</p><strong className="text-lg tabular-nums">{value.toLocaleString("fr-FR")}</strong></div></div>;
}

function CourseFilters({ params, categories, instructors, hasFilters }: { params: Params; categories: Array<{ id: string; name: string }>; instructors: Array<{ id: string; name: string | null; email: string }>; hasFilters: boolean }) {
  return <form className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-border/75 bg-card p-2.5 shadow-sm xl:flex-nowrap" role="search"><div className="relative min-w-60 flex-[2_1_22rem]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input name="q" aria-label="Rechercher par titre ou slug" defaultValue={params.q ?? ""} placeholder="Rechercher par titre ou slug…" className="h-9 pl-9" /></div><Select name="status" defaultValue={status ?? ""} aria-label="Statut" className="h-9 min-w-36 flex-1 py-1"><option value="">Statut · Tous</option><option value="DRAFT">Brouillons</option><option value="PENDING_REVIEW">À modérer</option><option value="PUBLISHED">Publiés</option><option value="REJECTED">Rejetés</option><option value="ARCHIVED">Archivés</option></Select><Select name="instructorId" defaultValue={params.instructorId ?? ""} aria-label="Formateur" className="h-9 min-w-40 flex-1 py-1"><option value="">Formateur · Tous</option>{instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.name ?? instructor.email}</option>)}</Select><Select name="categoryId" defaultValue={params.categoryId ?? ""} aria-label="Catégorie" className="h-9 min-w-40 flex-1 py-1"><option value="">Catégorie · Toutes</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select><Button type="submit" variant="outline" size="sm" className="h-9"><SlidersHorizontal className="h-4 w-4" />Filtres</Button>{hasFilters ? <Button variant="ghost" size="icon" className="h-9 w-9" asChild><Link href="/admin/cours" aria-label="Réinitialiser les filtres" title="Réinitialiser les filtres"><RotateCcw className="h-4 w-4" /></Link></Button> : null}</form>;
}
