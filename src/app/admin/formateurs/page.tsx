import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
  TrendingUp,
  Users,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Formateurs — CRM admin" };

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ stripe?: string; q?: string }>;
}

export default async function AdminInstructorsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const where = {
    isInstructor: true,
    ...(params.stripe === "missing"
      ? { stripeOnboardingDone: false }
      : params.stripe === "ready"
        ? { stripeOnboardingDone: true }
        : {}),
    ...(params.q
      ? {
          OR: [
            { email: { contains: params.q, mode: "insensitive" as const } },
            { name: { contains: params.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [instructors, totalInstructors, readyInstructors, missingInstructors] =
    await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          _count: { select: { coursesAuthored: true } },
          coursesAuthored: {
            select: {
              id: true,
              totalEnrollments: true,
              averageRating: true,
              totalRatings: true,
              status: true,
            },
          },
        },
      }),
      prisma.user.count({ where: { isInstructor: true } }),
      prisma.user.count({
        where: { isInstructor: true, stripeOnboardingDone: true },
      }),
      prisma.user.count({
        where: { isInstructor: true, stripeOnboardingDone: false },
      }),
    ]);

  // KPIs cumulés par instructor (revenus EUR uniquement, light)
  const ids = instructors.map((i) => i.id);
  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: { status: "PAID" },
      course: { instructorId: { in: ids } },
    },
    select: {
      currency: true,
      instructorPayoutCents: true,
      course: { select: { instructorId: true } },
    },
  });
  const revenueMap = new Map<string, number>();
  for (const it of orderItems) {
    if (it.currency !== "EUR") continue;
    const prev = revenueMap.get(it.course.instructorId) ?? 0;
    revenueMap.set(it.course.instructorId, prev + it.instructorPayoutCents);
  }

  // Calculs : top performers + cumulé
  const enrichedInstructors = instructors
    .map((u) => {
      const totalEnrollments = u.coursesAuthored.reduce(
        (sum, c) => sum + c.totalEnrollments,
        0,
      );
      const ratedCourses = u.coursesAuthored.filter((c) => c.totalRatings > 0);
      const avg =
        ratedCourses.length > 0
          ? ratedCourses.reduce((sum, c) => sum + c.averageRating, 0) /
            ratedCourses.length
          : 0;
      const publishedCount = u.coursesAuthored.filter(
        (c) => c.status === "PUBLISHED",
      ).length;
      const revenue = revenueMap.get(u.id) ?? 0;
      return { user: u, totalEnrollments, avg, revenue, publishedCount };
    })
    .sort((a, b) => b.revenue - a.revenue); // tri par revenu desc

  const totalRevenueEUR = enrichedInstructors.reduce(
    (sum, e) => sum + e.revenue,
    0,
  );
  const onboardingRate =
    totalInstructors > 0 ? (readyInstructors / totalInstructors) * 100 : 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <GraduationCap
            className="h-6 w-6 text-[color:var(--brand-primary)]"
            aria-hidden
          />
          Formateurs
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalInstructors.toLocaleString("fr-FR")} formateurs au total ·
          Pipeline Stripe Connect, leaderboard revenus.
        </p>
      </header>

      {/* KPIs Pipeline */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total formateurs"
          value={totalInstructors}
          icon={<Users className="h-4 w-4" />}
        />
        <KpiCard
          label="Stripe prêt"
          value={readyInstructors}
          icon={<CheckCircle2 className="h-4 w-4" />}
          hint={`${onboardingRate.toFixed(0)}% onboardés`}
        />
        <KpiCard
          label="Stripe à finaliser"
          value={missingInstructors}
          icon={<AlertTriangle className="h-4 w-4" />}
          hint={
            missingInstructors > 0 ? "À relancer pour payouts" : "Tous prêts"
          }
          href="/admin/formateurs?stripe=missing"
        />
        <KpiCard
          label="Revenu cumulé EUR"
          value={`${(totalRevenueEUR / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`}
          icon={<TrendingUp className="h-4 w-4" />}
          hint="Part nette formateurs (page actuelle)"
        />
      </section>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4">
          <form className="flex flex-wrap items-center gap-3">
            <Input
              name="q"
              placeholder="Email ou nom…"
              defaultValue={params.q ?? ""}
              className="max-w-xs"
            />
            <nav aria-label="Filtre Stripe" className="flex gap-1">
              <FilterChip href="/admin/formateurs" active={!params.stripe}>
                Tous
              </FilterChip>
              <FilterChip
                href="/admin/formateurs?stripe=ready"
                active={params.stripe === "ready"}
              >
                Stripe prêt
              </FilterChip>
              <FilterChip
                href="/admin/formateurs?stripe=missing"
                active={params.stripe === "missing"}
              >
                Stripe à finaliser
              </FilterChip>
            </nav>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Formateur</th>
                <th className="px-4 py-3">Stripe</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">
                  Cours
                </th>
                <th className="hidden px-4 py-3 text-right lg:table-cell">
                  Élèves
                </th>
                <th className="hidden px-4 py-3 text-right lg:table-cell">
                  Note
                </th>
                <th className="px-4 py-3 text-right">Revenus EUR</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {enrichedInstructors.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Aucun formateur.
                  </td>
                </tr>
              ) : (
                enrichedInstructors.map((e, idx) => {
                  const u = e.user;
                  const isTopThree = idx < 3 && e.revenue > 0;
                  return (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                        {isTopThree ? (
                          <span
                            className={cn(
                              "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                              idx === 0
                                ? "bg-[color:var(--brand-warning)]/20 text-[color:var(--brand-warning)]"
                                : "bg-[color:var(--brand-secondary)]/15 text-[color:var(--brand-secondary)]",
                            )}
                          >
                            {idx + 1}
                          </span>
                        ) : (
                          idx + 1
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {u.name ?? u.email}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                        {e.publishedCount > 0 && e.publishedCount !== u._count.coursesAuthored ? (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {e.publishedCount} publié{e.publishedCount > 1 ? "s" : ""}{" "}
                            / {u._count.coursesAuthored} total
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {u.stripeOnboardingDone ? (
                          <StatusBadge tone="success">Connecté</StatusBadge>
                        ) : u.stripeAccountId ? (
                          <StatusBadge tone="warning">En cours</StatusBadge>
                        ) : (
                          <StatusBadge tone="danger">Non configuré</StatusBadge>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                        {u._count.coursesAuthored}
                      </td>
                      <td className="hidden px-4 py-3 text-right tabular-nums lg:table-cell">
                        {e.totalEnrollments.toLocaleString("fr-FR")}
                      </td>
                      <td className="hidden px-4 py-3 text-right lg:table-cell">
                        {e.avg > 0 ? (
                          <span className="tabular-nums">
                            {e.avg.toFixed(1)} ★
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {(e.revenue / 100).toLocaleString("fr-FR", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/utilisateurs/${u.id}`}
                          className="text-sm font-medium text-[color:var(--brand-secondary)] hover:underline"
                        >
                          Fiche →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-colors",
        active
          ? "border-[color:var(--brand-secondary)] bg-[color:var(--brand-secondary)]/10 text-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
