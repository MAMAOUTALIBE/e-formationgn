import type { Metadata } from "next";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Building2,
  CircleCheckBig,
  CircleOff,
  FileCheck2,
  MapPin,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getCompanyDashboardStats,
  listCompanies,
  type CompanyListRow,
} from "@/server/queries/admin-companies";

export const metadata: Metadata = { title: "Sociétés — CRM admin" };
export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ARCHIVED: "Archivée",
} as const;

interface PageProps {
  searchParams: Promise<{ q?: string; statut?: string; ville?: string; page?: string }>;
}

export default async function CompaniesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = isCompanyStatus(params.statut) ? params.statut : undefined;
  const [result, stats] = await Promise.all([
    listCompanies({
      search: params.q,
      status,
      city: params.ville,
      page: Number(params.page) || 1,
    }),
    getCompanyDashboardStats(),
  ]);
  const { rows, total, page, pageSize } = result;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(params.q || params.statut || params.ville);

  return (
    <div className="space-y-5" data-testid="companies-workspace">
      <div className="text-xs text-muted-foreground">
        <Link href="/admin" className="hover:text-foreground">CRM</Link>
        <span className="px-2" aria-hidden>/</span>
        <span className="font-medium text-foreground">Gestion des sociétés</span>
      </div>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">
            <Building2 className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gestion des sociétés</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Gérez les entreprises partenaires et les apprenants qui leur sont rattachés.
            </p>
          </div>
        </div>
        <Button asChild className="shadow-sm">
          <Link href="/admin/societes/nouvelle">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            Nouvelle société
          </Link>
        </Button>
      </header>

      <section aria-label="Statistiques des sociétés" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total des sociétés" value={stats.total} icon={<Building2 className="h-5 w-5" />} tone="blue" hint={`${stats.createdThisMonth} créée${stats.createdThisMonth > 1 ? "s" : ""} ce mois`} href="/admin/societes" appearance="crm" />
        <KpiCard label="Sociétés actives" value={stats.active} icon={<CircleCheckBig className="h-5 w-5" />} tone="emerald" hint={`${stats.studentsAttached} apprenant${stats.studentsAttached > 1 ? "s" : ""} rattaché${stats.studentsAttached > 1 ? "s" : ""}`} href="/admin/societes?statut=ACTIVE" appearance="crm" />
        <KpiCard label="Sociétés inactives" value={stats.inactive} icon={<CircleOff className="h-5 w-5" />} tone="amber" hint="À réactiver ou archiver" href="/admin/societes?statut=INACTIVE" appearance="crm" />
        <KpiCard label="Sociétés archivées" value={stats.archived} icon={<Archive className="h-5 w-5" />} tone="slate" hint="Historique conservé" href="/admin/societes?statut=ARCHIVED" appearance="crm" />
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border/75 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
          <form className="grid gap-3 border-b border-border/70 p-4 sm:grid-cols-2 2xl:grid-cols-[minmax(15rem,1.4fr)_minmax(10rem,0.8fr)_minmax(10rem,0.8fr)_auto]" role="search">
            <div>
              <label htmlFor="q" className="mb-1.5 block text-xs font-semibold text-foreground">Rechercher</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Raison sociale, SIRET, ville…" className="pl-9" />
              </div>
            </div>
            <div>
              <label htmlFor="statut" className="mb-1.5 block text-xs font-semibold text-foreground">Statut</label>
              <select id="statut" name="statut" defaultValue={params.statut ?? ""} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                <option value="">Tous les statuts</option>
                <option value="ACTIVE">Actives</option>
                <option value="INACTIVE">Inactives</option>
                <option value="ARCHIVED">Archivées</option>
              </select>
            </div>
            <div>
              <label htmlFor="ville" className="mb-1.5 block text-xs font-semibold text-foreground">Ville</label>
              <select id="ville" name="ville" defaultValue={params.ville ?? ""} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                <option value="">Toutes les villes</option>
                {stats.cities.map((city) => <option key={city} value={city}>{city}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" variant="outline" className="flex-1 2xl:flex-none">
                <SlidersHorizontal className="mr-1.5 h-4 w-4" aria-hidden />
                Filtrer
              </Button>
              {hasFilters ? (
                <Button variant="ghost" size="icon" asChild title="Réinitialiser les filtres">
                  <Link href="/admin/societes" aria-label="Réinitialiser les filtres"><RotateCcw className="h-4 w-4" /></Link>
                </Button>
              ) : null}
            </div>
          </form>

          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<Building2 className="h-6 w-6" aria-hidden />} title={hasFilters ? "Aucune société trouvée" : "Aucune société enregistrée"} description={hasFilters ? "Modifiez ou réinitialisez les filtres pour élargir la recherche." : "Créez une première société pour pouvoir rattacher des apprenants."} action={<Button asChild><Link href="/admin/societes/nouvelle">Créer une société</Link></Button>} />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <CompanyTable rows={rows} />
              </div>
              <div className="divide-y divide-border/60 md:hidden">
                {rows.map((company) => <CompanyMobileCard key={company.id} company={company} />)}
              </div>
            </>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
            <span>
              {total === 0 ? "Aucun résultat" : `Affichage de ${(page - 1) * pageSize + 1} à ${Math.min(page * pageSize, total)} sur ${total} société${total > 1 ? "s" : ""}`}
            </span>
            {lastPage > 1 ? <Pagination params={params} page={page} lastPage={lastPage} /> : null}
          </footer>
        </section>

        <CreationGuide />
      </div>
    </div>
  );
}

function CompanyTable({ rows }: { rows: CompanyListRow[] }) {
  return (
    <table className="w-full min-w-[56rem] text-sm">
      <thead className="border-b border-border bg-muted/35 text-left text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        <tr><th className="px-4 py-3 font-semibold">Société</th><th className="px-4 py-3 font-semibold">SIRET</th><th className="px-4 py-3 font-semibold">Ville</th><th className="px-4 py-3 font-semibold">Statut</th><th className="px-4 py-3 text-right font-semibold">Apprenants</th><th className="px-4 py-3 font-semibold">Inscription</th><th className="px-4 py-3 text-right font-semibold">Action</th></tr>
      </thead>
      <tbody className="divide-y divide-border/60">
        {rows.map((company) => (
          <tr key={company.id} className="group hover:bg-muted/35">
            <td className="px-4 py-3"><div className="flex items-center gap-3"><CompanyAvatar name={company.name} /><div className="min-w-0"><Link href={`/admin/societes/${company.id}`} className="block max-w-56 truncate font-semibold text-foreground hover:underline">{company.name}</Link><span className="block truncate text-[10px] text-muted-foreground">{company.opco ?? "Organisme partenaire"}</span></div></div></td>
            <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatSiret(company.siret)}</td>
            <td className="px-4 py-3 text-muted-foreground">{company.city ?? "—"}</td>
            <td className="px-4 py-3"><CompanyStatus status={company.status} /></td>
            <td className="px-4 py-3 text-right font-semibold tabular-nums">{company.studentCount}</td>
            <td className="px-4 py-3 text-muted-foreground"><time dateTime={company.createdAt.toISOString()}>{new Intl.DateTimeFormat("fr-FR").format(company.createdAt)}</time></td>
            <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" asChild><Link href={`/admin/societes/${company.id}`}>Ouvrir</Link></Button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CompanyMobileCard({ company }: { company: CompanyListRow }) {
  return (
    <Link href={`/admin/societes/${company.id}`} className="block p-4 hover:bg-muted/35">
      <div className="flex items-start gap-3"><CompanyAvatar name={company.name} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h2 className="truncate font-semibold">{company.name}</h2><CompanyStatus status={company.status} /></div><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" aria-hidden />{company.city ?? "Ville non renseignée"}</p><div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>{formatSiret(company.siret)}</span><span className="flex items-center gap-1 font-medium text-foreground"><UsersRound className="h-3.5 w-3.5" />{company.studentCount}</span></div></div></div>
    </Link>
  );
}

function CreationGuide() {
  const steps = [
    { icon: Building2, title: "Informations générales", text: "Identité et coordonnées" },
    { icon: FileCheck2, title: "Financement & dossier", text: "OPCO et n° d’adhérent" },
    { icon: UsersRound, title: "Apprenants rattachés", text: "Suivi des collaborateurs" },
    { icon: ShieldCheck, title: "Validation", text: "Statut et notes internes" },
  ];
  return (
    <aside className="rounded-2xl border border-border/75 bg-card p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)] xl:sticky xl:top-4">
      <h2 className="text-base font-semibold">Créer une nouvelle société</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Ajoutez une entreprise partenaire en quelques étapes, puis rattachez ses apprenants.</p>
      <ol className="mt-5 space-y-4">
        {steps.map(({ icon: Icon, title, text }, index) => (
          <li key={title} className="relative flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[color:var(--brand-primary)] dark:bg-blue-500/10"><Icon className="h-4 w-4" aria-hidden /></span><div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs text-muted-foreground">{text}</p></div>{index < steps.length - 1 ? <span className="absolute left-[1.1rem] top-10 h-4 border-l border-dashed border-border" aria-hidden /> : null}</li>
        ))}
      </ol>
      <Button asChild className="mt-6 w-full"><Link href="/admin/societes/nouvelle"><Plus className="mr-1.5 h-4 w-4" />Commencer la création</Link></Button>
    </aside>
  );
}

function CompanyAvatar({ name }: { name: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
  return <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-sky-100 text-xs font-bold text-slate-700 ring-1 ring-inset ring-white dark:from-emerald-500/20 dark:to-sky-500/20 dark:text-slate-200">{initials || "S"}</span>;
}

function CompanyStatus({ status }: { status: string }) {
  const tone = status === "ACTIVE" ? "success" : status === "INACTIVE" ? "warning" : "neutral";
  return <StatusBadge tone={tone}>{STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status}</StatusBadge>;
}

function Pagination({ params, page, lastPage }: { params: PageProps["searchParams"] extends Promise<infer P> ? P : never; page: number; lastPage: number }) {
  return (
    <nav className="flex items-center gap-1" aria-label="Pagination des sociétés">
      <Button variant="outline" size="icon" className="h-8 w-8" asChild={page > 1} disabled={page <= 1}>{page > 1 ? <Link href={buildPageHref(params, page - 1)} aria-label="Page précédente"><ArrowLeft className="h-3.5 w-3.5" /></Link> : <ArrowLeft className="h-3.5 w-3.5" />}</Button>
      <span className="px-2 font-semibold text-foreground">{page} / {lastPage}</span>
      <Button variant="outline" size="icon" className="h-8 w-8" asChild={page < lastPage} disabled={page >= lastPage}>{page < lastPage ? <Link href={buildPageHref(params, page + 1)} aria-label="Page suivante"><ArrowRight className="h-3.5 w-3.5" /></Link> : <ArrowRight className="h-3.5 w-3.5" />}</Button>
    </nav>
  );
}

function isCompanyStatus(value?: string): value is "ACTIVE" | "INACTIVE" | "ARCHIVED" {
  return value === "ACTIVE" || value === "INACTIVE" || value === "ARCHIVED";
}

function formatSiret(siret: string | null): string {
  return siret ? siret.replace(/(\d{3})(?=\d)/g, "$1 ") : "SIRET non renseigné";
}

function buildPageHref(params: { q?: string; statut?: string; ville?: string }, page: number): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.statut) sp.set("statut", params.statut);
  if (params.ville) sp.set("ville", params.ville);
  sp.set("page", String(page));
  return `/admin/societes?${sp.toString()}`;
}
