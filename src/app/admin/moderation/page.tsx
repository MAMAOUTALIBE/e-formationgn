import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Flag,
  History,
  ShieldAlert,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Modération — CRM admin" };

export const dynamic = "force-dynamic";

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 3600 * 1000);
}

export default async function AdminModerationHubPage() {
  const now = new Date();

  const [
    pendingReports,
    totalRules,
    hiddenReviews,
    recentReports,
    oldReports,
    resolvedThisMonth,
    autoModerated,
    oldestPending,
    byTargetType,
  ] = await Promise.all([
    prisma.report.count({ where: { status: "PENDING" } }),
    prisma.moderationRule.count({ where: { isActive: true } }),
    prisma.review.count({ where: { isPublished: false } }),
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { reporter: { select: { name: true, email: true } } },
    }),
    // Signalements ouverts > 3 jours (= aging)
    prisma.report.count({
      where: { status: "PENDING", createdAt: { lt: daysAgo(3) } },
    }),
    // Résolus ce mois (hidden, deleted ou dismissed)
    prisma.report.count({
      where: {
        status: { in: ["RESOLVED_HIDDEN", "RESOLVED_DELETED", "DISMISSED"] },
        resolvedAt: { gte: daysAgo(30) },
      },
    }),
    // Reviews auto-démasqués par IA modération
    prisma.auditLog.count({
      where: {
        action: "review.auto_unpublished",
        createdAt: { gte: daysAgo(30) },
      },
    }),
    // Plus vieux signalement non-résolu
    prisma.report.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        targetType: true,
        reason: true,
        createdAt: true,
        reporter: { select: { name: true, email: true } },
      },
    }),
    // Répartition par type de cible
    prisma.report.groupBy({
      by: ["targetType"],
      where: { status: "PENDING" },
      _count: { _all: true },
    }),
  ]);

  const formatAge = (date: Date): string => {
    const ms = now.getTime() - date.getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (days > 0) return `${days} jour${days > 1 ? "s" : ""}`;
    return `${hours} h`;
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <ShieldAlert
            className="h-6 w-6 text-[color:var(--brand-primary)]"
            aria-hidden
          />
          Modération
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          File des signalements, règles automatiques, historique des actions.
        </p>
      </header>

      {oldReports > 0 ? (
        <section className="flex items-start gap-3 rounded-lg border border-[color:var(--brand-warning)]/30 bg-[color:var(--brand-warning)]/5 p-4">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--brand-warning)]"
            aria-hidden
          />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-foreground">
              {oldReports} signalement{oldReports > 1 ? "s" : ""} en attente
              depuis &gt; 3 jours
            </p>
            <p className="mt-0.5 text-muted-foreground">
              File qui s&apos;allonge — à trier en priorité pour éviter le
              ressentiment côté reporters.
            </p>
          </div>
          <Link
            href="/admin/moderation/signalements"
            className="shrink-0 text-sm font-medium text-[color:var(--brand-warning)] hover:underline"
          >
            Voir la file →
          </Link>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Signalements en attente"
          value={pendingReports}
          icon={<Flag className="h-4 w-4" />}
          href="/admin/moderation/signalements"
          hint={oldReports > 0 ? `${oldReports} > 3 jours ⚠` : "À jour"}
        />
        <KpiCard
          label="Résolus 30j"
          value={resolvedThisMonth}
          icon={<CheckCircle2 className="h-4 w-4" />}
          hint="Volume traité ces 30 jours"
        />
        <KpiCard
          label="Auto-modérés 30j"
          value={autoModerated}
          icon={<ShieldAlert className="h-4 w-4" />}
          hint="Avis démasqués par IA"
        />
        <KpiCard
          label="Règles actives"
          value={totalRules}
          icon={<AlertCircle className="h-4 w-4" />}
          href="/admin/moderation/regles"
        />
        <KpiCard
          label="Avis masqués"
          value={hiddenReviews}
          icon={<FileText className="h-4 w-4" />}
        />
      </section>

      {/* Répartition par type de cible */}
      {byTargetType.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Répartition des signalements en attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {byTargetType.map((b) => (
                <li
                  key={b.targetType}
                  className="rounded-md border border-border p-3"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {b.targetType}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {b._count._all}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {oldestPending ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Plus vieux signalement en attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {oldestPending.targetType} · {oldestPending.reason}
                </p>
                <p className="text-xs text-muted-foreground">
                  Signalé par{" "}
                  {oldestPending.reporter.name ?? oldestPending.reporter.email}{" "}
                  · ancien de {formatAge(oldestPending.createdAt)}
                </p>
              </div>
              <Link
                href="/admin/moderation/signalements"
                className="text-sm font-medium text-[color:var(--brand-secondary)] hover:underline"
              >
                Traiter maintenant →
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sous-modules</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-3">
            <Tile
              href="/admin/moderation/signalements"
              icon={<Flag className="h-4 w-4" />}
              label="Signalements"
              description="Avis, Q&A, utilisateurs et formations signalés."
            />
            <Tile
              href="/admin/moderation/regles"
              icon={<AlertCircle className="h-4 w-4" />}
              label="Règles automatiques"
              description="Mots-clés, regex, actions auto (flag/hide/block)."
            />
            <Tile
              href="/admin/moderation/historique"
              icon={<History className="h-4 w-4" />}
              label="Historique"
              description="Toutes les actions de modération (audit log)."
            />
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Derniers signalements</CardTitle>
        </CardHeader>
        <CardContent>
          {recentReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun signalement.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {recentReports.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
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

function Tile({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-start gap-3 rounded-md border border-border p-3 transition-colors hover:border-[color:var(--brand-secondary)] hover:bg-muted/50"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </Link>
    </li>
  );
}
