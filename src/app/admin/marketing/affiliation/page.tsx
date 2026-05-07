import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Affiliation" };

export const dynamic = "force-dynamic";

function thirtyDaysAgo() {
  return new Date(Date.now() - 30 * 24 * 3600 * 1000);
}

export default async function AffiliationPage() {
  // Top affiliés sur 30 j : nombre de clics + commandes attribuées
  const [topAffiliates, recentClicks] = await Promise.all([
    prisma.affiliateClick.groupBy({
      by: ["affiliateUserId"],
      where: { createdAt: { gte: thirtyDaysAgo() } },
      _count: { _all: true },
      orderBy: { _count: { affiliateUserId: "desc" } },
      take: 20,
    }),
    prisma.affiliateClick.count({ where: { createdAt: { gte: thirtyDaysAgo() } } }),
  ]);

  const ids = topAffiliates.map((t) => t.affiliateUserId);
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true, affiliateCode: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Affiliation
        </h1>
        <p className="text-sm text-muted-foreground">
          {recentClicks.toLocaleString("fr-FR")} clics affiliés ces 30 derniers jours.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top affiliés (30 j)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Formateur</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3 text-right">Clics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {topAffiliates.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                    Aucune activité d&apos;affiliation.
                  </td>
                </tr>
              ) : (
                topAffiliates.map((t) => {
                  const u = userMap.get(t.affiliateUserId);
                  return (
                    <tr key={t.affiliateUserId} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/utilisateurs/${t.affiliateUserId}`}
                          className="hover:underline"
                        >
                          {u?.name ?? u?.email ?? "(supprimé)"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {u?.affiliateCode ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {t._count._all}
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
