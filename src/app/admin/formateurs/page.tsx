import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Formateurs" };

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

  const instructors = await prisma.user.findMany({
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
        },
      },
    },
  });

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

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Formateurs
        </h1>
        <p className="text-sm text-muted-foreground">
          {instructors.length} formateur{instructors.length > 1 ? "s" : ""} affichés.
        </p>
      </header>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Formateur</th>
                <th className="px-4 py-3">Stripe</th>
                <th className="px-4 py-3 text-right">Cours</th>
                <th className="hidden px-4 py-3 text-right lg:table-cell">Élèves</th>
                <th className="hidden px-4 py-3 text-right lg:table-cell">Note</th>
                <th className="px-4 py-3 text-right">Revenus EUR</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {instructors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Aucun formateur.
                  </td>
                </tr>
              ) : (
                instructors.map((u) => {
                  const totalEnrollments = u.coursesAuthored.reduce(
                    (sum, c) => sum + c.totalEnrollments,
                    0,
                  );
                  const ratedCourses = u.coursesAuthored.filter((c) => c.totalRatings > 0);
                  const avg = ratedCourses.length > 0
                    ? ratedCourses.reduce((sum, c) => sum + c.averageRating, 0) /
                      ratedCourses.length
                    : 0;
                  const revenue = revenueMap.get(u.id) ?? 0;
                  return (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {u.name ?? u.email}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
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
                      <td className="px-4 py-3 text-right">
                        {u._count.coursesAuthored}
                      </td>
                      <td className="hidden px-4 py-3 text-right lg:table-cell">
                        {totalEnrollments}
                      </td>
                      <td className="hidden px-4 py-3 text-right lg:table-cell">
                        {avg > 0 ? avg.toFixed(1) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {(revenue / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
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
