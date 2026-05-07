import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Modération" };

export const dynamic = "force-dynamic";

export default async function AdminModerationHubPage() {
  const [pendingReports, totalRules, hiddenReviews, recentReports] = await Promise.all([
    prisma.report.count({ where: { status: "PENDING" } }),
    prisma.moderationRule.count({ where: { isActive: true } }),
    prisma.review.count({ where: { isPublished: false } }),
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { reporter: { select: { name: true, email: true } } },
    }),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Modération
        </h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Signalements en attente" value={pendingReports} href="/admin/moderation/signalements" />
        <KpiCard label="Règles actives" value={totalRules} href="/admin/moderation/regles" />
        <KpiCard label="Avis masqués" value={hiddenReviews} />
        <KpiCard label="Historique" value="Voir" href="/admin/moderation/historique" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sous-modules</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <li>
              <Link
                href="/admin/moderation/signalements"
                className="block rounded-md border border-border p-3 hover:bg-muted/50"
              >
                <p className="font-medium">Signalements</p>
                <p className="text-xs text-muted-foreground">
                  Avis, Q&amp;A, utilisateurs et cours signalés.
                </p>
              </Link>
            </li>
            <li>
              <Link
                href="/admin/moderation/regles"
                className="block rounded-md border border-border p-3 hover:bg-muted/50"
              >
                <p className="font-medium">Règles automatiques</p>
                <p className="text-xs text-muted-foreground">
                  Mots-clés interdits, regex, actions auto (flag/hide/block).
                </p>
              </Link>
            </li>
            <li>
              <Link
                href="/admin/moderation/historique"
                className="block rounded-md border border-border p-3 hover:bg-muted/50"
              >
                <p className="font-medium">Historique</p>
                <p className="text-xs text-muted-foreground">
                  Toutes les actions de modération (audit log).
                </p>
              </Link>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signalements récents</CardTitle>
        </CardHeader>
        <CardContent>
          {recentReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun signalement.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {recentReports.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">
                      {r.targetType} · {r.reason}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      par {r.reporter.name ?? r.reporter.email} ·{" "}
                      {r.createdAt.toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <Link
                    href="/admin/moderation/signalements"
                    className="text-sm font-medium text-[color:var(--brand-secondary)] hover:underline"
                  >
                    Traiter →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
