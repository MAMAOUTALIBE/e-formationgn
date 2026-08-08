import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarPlus,
  ChevronRight,
  FileUp,
  GraduationCap,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";

import { CreateAccountForm } from "@/components/features/admin/create-account-form";
import { ImportStudentsForm } from "@/components/features/admin/import-students-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButton } from "@/components/ui/export-button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AccountStatus, UserRole } from "@/generated/prisma/enums";
import { isTrainingCenterMode } from "@/lib/platform-mode";
import { prisma } from "@/lib/prisma";
import { exportUsersCsv } from "@/server/actions/admin-users";
import { listSelectableCompanies } from "@/server/queries/admin-companies";
import {
  getAdminUsersDashboardStats,
  listAdminUsers,
  listUserCountries,
  type AdminUserRow,
  type AdminUsersDashboardStats,
} from "@/server/queries/admin-users";

export const metadata: Metadata = { title: "Apprenants — CRM admin" };
export const dynamic = "force-dynamic";

interface UserSearchParams {
  q?: string;
  role?: UserRole | "ALL";
  companyId?: string;
  status?: AccountStatus;
  banned?: string;
  country?: string;
  page?: string;
}

interface PageProps {
  searchParams: Promise<UserSearchParams>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const trainingCenter = isTrainingCenterMode();
  const filters = {
    q: params.q,
    role: params.role === "ALL" ? undefined : ((params.role as UserRole) ?? "STUDENT"),
    companyId: params.companyId,
    status: params.status,
    country: params.country,
    banned: params.banned === "1" ? true : params.banned === "0" ? false : undefined,
    page: Number(params.page) || 1,
    pageSize: 50,
  };

  const [{ rows, total, page, pageSize }, companies, countries, stats, publishedCourses] =
    await Promise.all([
      listAdminUsers(filters),
      listSelectableCompanies(),
      listUserCountries(),
      getAdminUsersDashboardStats(),
      trainingCenter
        ? prisma.course.findMany({
            where: { status: "PUBLISHED" },
            orderBy: { title: "asc" },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(
    params.q || params.companyId || params.status || params.banned || params.country || params.role === "ALL" || (params.role && params.role !== "STUDENT"),
  );

  return (
    <div className="space-y-5" data-testid="learners-workspace">
      <div className="text-xs text-muted-foreground">
        <Link href="/admin" className="hover:text-foreground">CRM</Link>
        <span className="px-2" aria-hidden>/</span>
        <span className="font-medium text-foreground">Gestion des apprenants</span>
      </div>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20">
            <UsersRound className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gestion des apprenants</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Pilotez les élèves, formateurs et rattachements aux sociétés.</p>
          </div>
        </div>
        {trainingCenter ? (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button variant="outline" asChild className="flex-1 sm:flex-none">
              <Link href="#import-promotion"><FileUp className="mr-1.5 h-4 w-4" />Importer une promotion</Link>
            </Button>
            <Button asChild className="flex-1 shadow-sm sm:flex-none">
              <Link href="#create-account"><Plus className="mr-1.5 h-4 w-4" />Créer un compte</Link>
            </Button>
          </div>
        ) : null}
      </header>

      <section aria-label="Statistiques des apprenants" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <KpiCard label="Total des comptes" value={stats.total} icon={<UsersRound className="h-5 w-5" />} tone="blue" hint="Élèves et formateurs" href="/admin/utilisateurs?role=ALL" appearance="crm" />
        <KpiCard label="Élèves" value={stats.students} icon={<GraduationCap className="h-5 w-5" />} tone="emerald" hint="Comptes apprenants" href="/admin/utilisateurs?role=STUDENT" appearance="crm" />
        <KpiCard label="Formateurs" value={stats.instructors} icon={<UserRoundPlus className="h-5 w-5" />} tone="sky" hint="Intervenants pédagogiques" href="/admin/utilisateurs?role=INSTRUCTOR" appearance="crm" />
        <KpiCard label="Nouveaux inscrits" value={stats.createdLast30Days} icon={<CalendarPlus className="h-5 w-5" />} tone="amber" hint="Sur les 30 derniers jours" appearance="crm" />
        <KpiCard label="Comptes actifs" value={stats.active} icon={<BadgeCheck className="h-5 w-5" />} tone="blue" hint={percentage(stats.active, stats.total)} href="/admin/utilisateurs?role=ALL&status=ACTIVE&banned=0" appearance="crm" />
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-border/75 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
          <UserFilters params={params} companies={companies} countries={countries} hasFilters={hasFilters} />

          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<UsersRound className="h-6 w-6" />} title="Aucun compte trouvé" description={hasFilters ? "Modifiez ou réinitialisez les filtres pour élargir la recherche." : "Créez un premier compte apprenant pour commencer."} />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block"><UsersTable rows={rows} /></div>
              <div className="divide-y divide-border/60 md:hidden">{rows.map((user) => <UserMobileCard key={user.id} user={user} />)}</div>
            </>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
            <span>{total === 0 ? "Aucun résultat" : `Affichage de ${(page - 1) * pageSize + 1} à ${Math.min(page * pageSize, total)} sur ${total} compte${total > 1 ? "s" : ""}`}</span>
            {totalPages > 1 ? <Pagination params={params} page={page} totalPages={totalPages} /> : null}
          </footer>
        </section>

        <LearnerSidebar stats={stats} trainingCenter={trainingCenter} />
      </div>

      {trainingCenter ? (
        <section className="grid scroll-mt-24 gap-4 xl:grid-cols-2" aria-label="Création et import de comptes">
          <details id="create-account" className="group scroll-mt-24 rounded-2xl border border-border/75 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)] open:pb-5">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-5 [&::-webkit-details-marker]:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"><UserRoundPlus className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">Créer un compte</span><span className="block text-xs text-muted-foreground">Ajouter un élève ou un formateur</span></span>
              <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <div className="border-t border-border/70 px-5 pt-5"><CreateAccountForm companies={companies} /></div>
          </details>

          <details id="import-promotion" className="group scroll-mt-24 rounded-2xl border border-border/75 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)] open:pb-5">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-5 [&::-webkit-details-marker]:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><FileUp className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">Importer une promotion</span><span className="block text-xs text-muted-foreground">Créer plusieurs comptes depuis un CSV</span></span>
              <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-90" />
            </summary>
            <div className="border-t border-border/70 px-5 pt-5"><ImportStudentsForm courses={publishedCourses} /></div>
          </details>
        </section>
      ) : null}
    </div>
  );
}

function UserFilters({ params, companies, countries, hasFilters }: { params: UserSearchParams; companies: Array<{ id: string; name: string; city: string | null }>; countries: Array<{ country: string; count: number }>; hasFilters: boolean }) {
  return (
    <form className="grid gap-3 border-b border-border/70 p-4 sm:grid-cols-2 2xl:grid-cols-[minmax(15rem,1.4fr)_repeat(4,minmax(9rem,0.8fr))_auto]" role="search">
      <div className="relative sm:col-span-2 2xl:col-span-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Rechercher un apprenant" name="q" defaultValue={params.q ?? ""} placeholder="Email, nom, prénom…" className="pl-9" /></div>
      <Select name="companyId" defaultValue={params.companyId ?? ""} aria-label="Société"><option value="">Toutes les sociétés</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</Select>
      <Select name="role" defaultValue={params.role ?? "STUDENT"} aria-label="Rôle"><option value="ALL">Tous les comptes</option><option value="STUDENT">Élèves</option><option value="INSTRUCTOR">Formateurs</option><option value="ADMIN">Administrateurs</option><option value="MODERATOR">Modérateurs</option><option value="SUPPORT">Support</option><option value="FINANCE">Finance</option><option value="MANAGER">Gestionnaires</option></Select>
      <Select name="status" defaultValue={params.status ?? ""} aria-label="Statut"><option value="">Tous les statuts</option><option value="ACTIVE">Actifs</option><option value="PENDING_VERIFICATION">En attente</option><option value="SUSPENDED">Suspendus</option><option value="DELETED">Supprimés</option></Select>
      <Select name="country" defaultValue={params.country ?? ""} aria-label="Pays"><option value="">Tous les pays</option>{countries.map(({ country, count }) => <option key={country} value={country}>{country} ({count})</option>)}</Select>
      <div className="flex gap-2 sm:col-span-2 2xl:col-span-1"><Button type="submit" className="flex-1"><SlidersHorizontal className="mr-1.5 h-4 w-4" />Filtrer</Button>{hasFilters ? <Button variant="outline" size="icon" asChild title="Réinitialiser"><Link href="/admin/utilisateurs" aria-label="Réinitialiser les filtres"><RotateCcw className="h-4 w-4" /></Link></Button> : null}</div>
      <div className="sm:col-span-2 2xl:col-span-6"><Select name="banned" defaultValue={params.banned ?? ""} aria-label="État de bannissement" className="sm:max-w-52"><option value="">Bannis : tous</option><option value="1">Bannis uniquement</option><option value="0">Non-bannis uniquement</option></Select></div>
    </form>
  );
}

function UsersTable({ rows }: { rows: AdminUserRow[] }) {
  return (
    <table className="w-full min-w-[62rem] text-sm"><thead className="border-b border-border bg-muted/35 text-left text-[10px] uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">Apprenant</th><th className="px-4 py-3 font-semibold">Société</th><th className="px-4 py-3 font-semibold">Rôle</th><th className="px-4 py-3 font-semibold">Statut</th><th className="px-4 py-3 font-semibold">Pays</th><th className="px-4 py-3 text-right font-semibold">Achats</th><th className="px-4 py-3 font-semibold">Inscrit le</th><th className="px-4 py-3 text-right font-semibold">Action</th></tr></thead>
      <tbody className="divide-y divide-border/60">{rows.map((user) => <tr key={user.id} className="hover:bg-muted/35"><td className="px-4 py-3"><div className="flex items-center gap-3"><UserAvatar name={user.name} email={user.email} /><div className="min-w-0"><Link href={`/admin/utilisateurs/${user.id}`} className="block max-w-52 truncate font-semibold hover:underline">{user.name ?? user.email}</Link><span className="block max-w-52 truncate text-[10px] text-muted-foreground">{user.email}</span></div></div></td><td className="px-4 py-3">{user.companyId && user.companyName ? <Link href={`/admin/societes/${user.companyId}`} className="text-muted-foreground hover:text-foreground hover:underline">{user.companyName}</Link> : <span className="text-muted-foreground">—</span>}</td><td className="px-4 py-3"><RoleBadge role={user.role} /></td><td className="px-4 py-3"><UserStatusBadge status={user.status} banned={Boolean(user.bannedAt)} /></td><td className="px-4 py-3 text-muted-foreground">{user.country ?? "—"}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{user.ordersCount}</td><td className="px-4 py-3 text-xs text-muted-foreground"><time dateTime={user.createdAt.toISOString()}>{user.createdAt.toLocaleDateString("fr-FR")}</time></td><td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" asChild><Link href={`/admin/utilisateurs/${user.id}`}>Ouvrir</Link></Button></td></tr>)}</tbody>
    </table>
  );
}

function UserMobileCard({ user }: { user: AdminUserRow }) {
  return <Link href={`/admin/utilisateurs/${user.id}`} className="block p-4 hover:bg-muted/35"><div className="flex gap-3"><UserAvatar name={user.name} email={user.email} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate font-semibold">{user.name ?? user.email}</h2><p className="truncate text-xs text-muted-foreground">{user.email}</p></div><UserStatusBadge status={user.status} banned={Boolean(user.bannedAt)} /></div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><RoleBadge role={user.role} /><span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{user.companyName ?? "Sans société"}</span><span>{user.ordersCount} achat{user.ordersCount > 1 ? "s" : ""}</span></div></div></div></Link>;
}

function LearnerSidebar({ stats, trainingCenter }: { stats: AdminUsersDashboardStats; trainingCenter: boolean }) {
  const statuses = [{ label: "Actifs", value: stats.active, color: "bg-emerald-500" }, { label: "En attente", value: stats.pending, color: "bg-amber-500" }, { label: "Suspendus", value: stats.suspended, color: "bg-orange-500" }, { label: "Bannis", value: stats.banned, color: "bg-rose-500" }, { label: "Supprimés", value: stats.deleted, color: "bg-slate-400" }];
  return <aside className="space-y-4 xl:sticky xl:top-4"><div className="rounded-2xl border border-border/75 bg-card p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)]"><h2 className="font-semibold">Actions rapides</h2><div className="mt-3 divide-y divide-border/60">{trainingCenter ? <><QuickLink href="#create-account" icon={<UserRoundPlus className="h-4 w-4" />} title="Créer un compte" text="Ajouter un élève ou formateur" /><QuickLink href="#import-promotion" icon={<FileUp className="h-4 w-4" />} title="Importer une promotion" text="Créer plusieurs comptes" /></> : null}<div className="py-3"><ExportButton action={exportUsersCsv} label="Exporter la liste" /></div></div></div><div className="rounded-2xl border border-border/75 bg-card p-5 shadow-[0_10px_35px_rgba(15,23,42,0.05)]"><h2 className="font-semibold">Statuts</h2><div className="mt-4 flex items-center gap-5"><StatusDonut stats={stats} /><ul className="min-w-0 flex-1 space-y-2.5">{statuses.map((status) => <li key={status.label} className="flex items-center justify-between gap-2 text-xs"><span className="flex items-center gap-2 text-muted-foreground"><span className={`h-2.5 w-2.5 rounded-full ${status.color}`} />{status.label}</span><strong className="tabular-nums">{status.value}</strong></li>)}</ul></div></div></aside>;
}

function QuickLink({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) { return <Link href={href} className="flex items-center gap-3 py-3 group"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{icon}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold group-hover:underline">{title}</span><span className="block truncate text-xs text-muted-foreground">{text}</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>; }

function StatusDonut({ stats }: { stats: AdminUsersDashboardStats }) { const total = Math.max(stats.total, 1); const active = stats.active / total * 100; const pending = stats.pending / total * 100; const suspended = stats.suspended / total * 100; const banned = stats.banned / total * 100; return <div className="relative h-24 w-24 shrink-0 rounded-full" role="img" aria-label={`${stats.active} comptes actifs sur ${stats.total}`} style={{ background: `conic-gradient(#10b981 0 ${active}%, #f59e0b ${active}% ${active + pending}%, #f97316 ${active + pending}% ${active + pending + suspended}%, #f43f5e ${active + pending + suspended}% ${active + pending + suspended + banned}%, #94a3b8 ${active + pending + suspended + banned}% 100%)` }}><span className="absolute inset-[14px] flex items-center justify-center rounded-full bg-card text-center text-xs font-semibold">{Math.round(active)}%<span className="sr-only"> actifs</span></span></div>; }

function UserAvatar({ name, email }: { name: string | null; email: string }) { const initials = (name ?? email).split(/[\s.@]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""); return <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-emerald-100 text-xs font-bold text-slate-700 ring-1 ring-inset ring-white dark:from-blue-500/20 dark:to-emerald-500/20 dark:text-slate-200">{initials || "U"}</span>; }

function RoleBadge({ role }: { role: UserRole }) { if (role === "ADMIN") return <StatusBadge tone="danger">Admin</StatusBadge>; if (role === "MODERATOR") return <StatusBadge tone="warning">Modérateur</StatusBadge>; if (role === "SUPPORT") return <StatusBadge tone="info">Support</StatusBadge>; if (role === "FINANCE") return <StatusBadge tone="info">Finance</StatusBadge>; if (role === "INSTRUCTOR") return <StatusBadge tone="warning">Formateur</StatusBadge>; if (role === "MANAGER") return <StatusBadge tone="info">Gestionnaire</StatusBadge>; return <StatusBadge tone="info">Élève</StatusBadge>; }

function UserStatusBadge({ status, banned }: { status: AccountStatus; banned: boolean }) { if (banned) return <StatusBadge tone="danger">Banni</StatusBadge>; if (status === "SUSPENDED") return <StatusBadge tone="warning">Suspendu</StatusBadge>; if (status === "DELETED") return <StatusBadge tone="neutral">Supprimé</StatusBadge>; if (status === "PENDING_VERIFICATION") return <StatusBadge tone="warning">En attente</StatusBadge>; return <StatusBadge tone="success">Actif</StatusBadge>; }

function Pagination({ params, page, totalPages }: { params: UserSearchParams; page: number; totalPages: number }) { return <nav className="flex items-center gap-1" aria-label="Pagination des apprenants"><Button variant="outline" size="icon" className="h-8 w-8" asChild={page > 1} disabled={page <= 1}>{page > 1 ? <Link href={pageHref(params, page - 1)} aria-label="Page précédente"><ArrowLeft className="h-3.5 w-3.5" /></Link> : <ArrowLeft className="h-3.5 w-3.5" />}</Button><span className="px-2 font-semibold text-foreground">{page} / {totalPages}</span><Button variant="outline" size="icon" className="h-8 w-8" asChild={page < totalPages} disabled={page >= totalPages}>{page < totalPages ? <Link href={pageHref(params, page + 1)} aria-label="Page suivante"><ArrowRight className="h-3.5 w-3.5" /></Link> : <ArrowRight className="h-3.5 w-3.5" />}</Button></nav>; }

function pageHref(params: UserSearchParams, page: number) { const search = new URLSearchParams(); for (const [key, value] of Object.entries(params)) if (value && key !== "page") search.set(key, value); search.set("page", String(page)); return `/admin/utilisateurs?${search.toString()}`; }
function percentage(value: number, total: number) { return total > 0 ? `${Math.round(value / total * 100)} % des comptes` : "Aucun compte enregistré"; }
