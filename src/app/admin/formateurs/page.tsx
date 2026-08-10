import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, GraduationCap, Plus, RotateCcw, Search, ShieldCheck, Star, TrendingUp, UsersRound, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButton } from "@/components/ui/export-button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";
import { exportInstructorsCsv } from "@/server/actions/admin-crm-exports";

export const metadata: Metadata = { title: "Formateurs — CRM admin" };
export const dynamic = "force-dynamic";

interface Params { stripe?: string; q?: string; page?: string }

export default async function AdminInstructorsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 25;
  const where = {
    isInstructor: true,
    ...(params.stripe === "missing" ? { stripeOnboardingDone: false } : params.stripe === "ready" ? { stripeOnboardingDone: true } : {}),
    ...(params.q ? { OR: [{ email: { contains: params.q, mode: "insensitive" as const } }, { name: { contains: params.q, mode: "insensitive" as const } }] } : {}),
  };

  const [instructors, filteredTotal, total, ready, allIds] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { _count: { select: { coursesAuthored: true } }, coursesAuthored: { select: { totalEnrollments: true, averageRating: true, totalRatings: true, status: true } } } }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { isInstructor: true } }),
    prisma.user.count({ where: { isInstructor: true, stripeOnboardingDone: true } }),
    prisma.user.findMany({ where: { isInstructor: true }, select: { id: true } }),
  ]);
  const missing = total - ready;
  const items = allIds.length ? await prisma.orderItem.findMany({ where: { order: { status: "PAID" }, course: { instructorId: { in: allIds.map((row) => row.id) } } }, select: { currency: true, instructorPayoutCents: true, course: { select: { instructorId: true } } } }) : [];
  const revenue = new Map<string, number>();
  let totalRevenue = 0;
  for (const item of items) if (item.currency === "EUR") { revenue.set(item.course.instructorId, (revenue.get(item.course.instructorId) ?? 0) + item.instructorPayoutCents); totalRevenue += item.instructorPayoutCents; }
  const rows = instructors.map((user) => { const rated = user.coursesAuthored.filter((course) => course.totalRatings > 0); return { user, enrollments: user.coursesAuthored.reduce((sum, course) => sum + course.totalEnrollments, 0), rating: rated.length ? rated.reduce((sum, course) => sum + course.averageRating, 0) / rated.length : 0, published: user.coursesAuthored.filter((course) => course.status === "PUBLISHED").length, revenue: revenue.get(user.id) ?? 0 }; });
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const hasFilters = Boolean(params.q || params.stripe);

  return <div className="space-y-5" data-testid="instructors-workspace">
    <div className="text-xs text-muted-foreground"><Link href="/admin" className="hover:text-foreground">CRM</Link><span className="px-2">/</span><span className="font-medium text-foreground">Gestion des formateurs</span></div>
    <header className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300"><GraduationCap className="h-6 w-6" /></span><div><h1 className="text-2xl font-semibold tracking-tight">Gestion des formateurs</h1><p className="mt-0.5 text-sm text-muted-foreground">Suivez leurs cours, élèves, évaluations, revenus et activation Stripe.</p></div></div><div className="grid w-full gap-2 sm:flex sm:w-auto [&>div]:w-full [&_button]:w-full"><ExportButton action={exportInstructorsCsv} /><Button asChild><Link href="/admin/equipe?role=INSTRUCTOR#create-staff"><Plus className="h-4 w-4" />Ajouter un formateur</Link></Button></div></header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Statistiques des formateurs"><KpiCard label="Total formateurs" value={total} icon={<UsersRound className="h-5 w-5" />} tone="blue" hint="Comptes formateurs" appearance="crm" /><KpiCard label="Stripe prêt" value={ready} icon={<BadgeCheck className="h-5 w-5" />} tone="emerald" hint={total ? `${Math.round(ready / total * 100)} % activés` : "Aucun compte"} href="/admin/formateurs?stripe=ready" appearance="crm" /><KpiCard label="Stripe à finaliser" value={missing} icon={<AlertTriangle className="h-5 w-5" />} tone="amber" hint="À relancer pour les versements" href="/admin/formateurs?stripe=missing" appearance="crm" /><KpiCard label="Revenu cumulé EUR" value={formatMoney(totalRevenue)} icon={<TrendingUp className="h-5 w-5" />} tone="sky" hint="Part nette des formateurs" appearance="crm" /></section>

    <section className="overflow-hidden rounded-2xl border border-border/75 bg-card shadow-[0_10px_35px_rgba(15,23,42,0.05)]"><form className="flex flex-wrap gap-3 border-b border-border/70 p-4" role="search"><div className="relative min-w-64 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input name="q" aria-label="Rechercher un formateur" defaultValue={params.q ?? ""} placeholder="Email ou nom du formateur…" className="pl-9" /></div><div className="flex flex-wrap gap-2"><Button type="submit" name="stripe" value="" variant={!params.stripe ? "default" : "outline"}>Tous</Button><Button type="submit" name="stripe" value="ready" variant={params.stripe === "ready" ? "default" : "outline"}>Stripe prêt</Button><Button type="submit" name="stripe" value="missing" variant={params.stripe === "missing" ? "default" : "outline"}>À finaliser</Button>{hasFilters ? <Button variant="ghost" size="icon" asChild><Link href="/admin/formateurs" aria-label="Réinitialiser"><RotateCcw className="h-4 w-4" /></Link></Button> : null}</div></form>
      {rows.length ? <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[62rem] text-sm"><thead className="border-b border-border bg-muted/35 text-left text-[10px] uppercase tracking-[.08em] text-muted-foreground"><tr><th className="px-4 py-3">Formateur</th><th className="px-4 py-3">Stripe</th><th className="px-4 py-3 text-right">Cours</th><th className="px-4 py-3 text-right">Élèves</th><th className="px-4 py-3 text-right">Note</th><th className="px-4 py-3 text-right">Revenus EUR</th><th className="px-4 py-3">Inscrit le</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-border/60">{rows.map(({ user, enrollments, rating, published, revenue: amount }) => <tr key={user.id} className="hover:bg-muted/35"><td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar name={user.name} email={user.email} /><div><Link href={`/admin/utilisateurs/${user.id}`} className="font-semibold hover:underline">{user.name ?? user.email}</Link><p className="text-[10px] text-muted-foreground">{user.email}</p></div></div></td><td className="px-4 py-3"><StripeBadge ready={user.stripeOnboardingDone} started={Boolean(user.stripeAccountId)} /></td><td className="px-4 py-3 text-right tabular-nums"><strong>{user._count.coursesAuthored}</strong><span className="block text-[10px] text-muted-foreground">{published} publiés</span></td><td className="px-4 py-3 text-right tabular-nums">{enrollments.toLocaleString("fr-FR")}</td><td className="px-4 py-3 text-right tabular-nums">{rating ? `${rating.toFixed(1)} ★` : "—"}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(amount)}</td><td className="px-4 py-3 text-xs text-muted-foreground">{user.createdAt.toLocaleDateString("fr-FR")}</td><td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" asChild><Link href={`/admin/utilisateurs/${user.id}`}>Fiche</Link></Button></td></tr>)}</tbody></table></div><div className="divide-y divide-border/60 md:hidden">{rows.map(({ user, enrollments, revenue: amount }) => <Link key={user.id} href={`/admin/utilisateurs/${user.id}`} className="block p-4 hover:bg-muted/35"><div className="flex gap-3"><Avatar name={user.name} email={user.email} /><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><h2 className="truncate font-semibold">{user.name ?? user.email}</h2><StripeBadge ready={user.stripeOnboardingDone} started={Boolean(user.stripeAccountId)} /></div><p className="truncate text-xs text-muted-foreground">{user.email}</p><p className="mt-2 text-xs text-muted-foreground">{user._count.coursesAuthored} cours · {enrollments} élèves · {formatMoney(amount)}</p></div></div></Link>)}</div></> : <div className="p-5"><EmptyState icon={<GraduationCap className="h-6 w-6" />} title="Aucun formateur trouvé" description="Modifiez les critères de recherche ou ajoutez un nouveau formateur." /></div>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground"><span>{filteredTotal} formateur{filteredTotal > 1 ? "s" : ""}</span>{totalPages > 1 ? <Pagination params={params} page={page} totalPages={totalPages} /> : null}</footer>
    </section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Info icon={<ShieldCheck className="h-5 w-5" />} title="Rôle formateur" text="Création et gestion autonome des cours." /><Info icon={<WalletCards className="h-5 w-5" />} title="Paiements sécurisés" text="Versements suivis via Stripe Connect." /><Info icon={<Star className="h-5 w-5" />} title="Notes et évaluations" text="Moyennes calculées sur les avis réels." /><Info icon={<TrendingUp className="h-5 w-5" />} title="Performances" text="Cours, élèves et revenus centralisés." /></section>
  </div>;
}

function Avatar({ name, email }: { name: string | null; email: string }) { const initials = (name ?? email).split(/[\s.@]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""); return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-orange-100 text-xs font-bold text-slate-700 dark:from-violet-500/20 dark:to-orange-500/20 dark:text-slate-200">{initials || "F"}</span>; }
function StripeBadge({ ready, started }: { ready: boolean; started: boolean }) { return ready ? <StatusBadge tone="success">Connecté</StatusBadge> : started ? <StatusBadge tone="warning">En cours</StatusBadge> : <StatusBadge tone="danger">Non configuré</StatusBadge>; }
function Info({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex gap-3 rounded-2xl border border-border/75 bg-card p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{icon}</span><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p></div></div>; }
function Pagination({ params, page, totalPages }: { params: Params; page: number; totalPages: number }) { const href = (next: number) => { const search = new URLSearchParams(); if (params.q) search.set("q", params.q); if (params.stripe) search.set("stripe", params.stripe); search.set("page", String(next)); return `/admin/formateurs?${search}`; }; return <nav className="flex items-center gap-1" aria-label="Pagination des formateurs"><Button size="icon" variant="outline" className="h-8 w-8" asChild={page > 1} disabled={page <= 1}>{page > 1 ? <Link href={href(page - 1)}><ArrowLeft className="h-4 w-4" /></Link> : <ArrowLeft className="h-4 w-4" />}</Button><strong className="px-2 text-foreground">{page} / {totalPages}</strong><Button size="icon" variant="outline" className="h-8 w-8" asChild={page < totalPages} disabled={page >= totalPages}>{page < totalPages ? <Link href={href(page + 1)}><ArrowRight className="h-4 w-4" /></Link> : <ArrowRight className="h-4 w-4" />}</Button></nav>; }
function formatMoney(cents: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100); }
