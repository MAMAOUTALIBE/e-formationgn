import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Activity, TrendingDown, Users } from "lucide-react";

import { auth } from "@/auth";
import { CourseFunnel } from "@/components/features/instructor/course-funnel";
import { CourseInsightsChart } from "@/components/features/instructor/course-insights-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import {
  getCourseFunnel,
  getCourseTimeseries,
  getLessonDropoff,
} from "@/server/queries/instructor";

export const metadata: Metadata = {
  title: "Insights — Formateur",
};

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseInsightsPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/formateur");

  const { id } = await params;
  const isAdmin = session.user.role === "ADMIN";
  const [timeseries, dropoff, enrollmentsCount, funnel] = await Promise.all([
    getCourseTimeseries(id, session.user.id, 30),
    getLessonDropoff(id, session.user.id),
    prisma.enrollment.count({ where: { courseId: id } }),
    getCourseFunnel(id, session.user.id, isAdmin),
  ]);

  if (timeseries === null || dropoff === null) notFound();

  // Stats agrégées sur les 30j
  const totalEnrollments30d = timeseries.reduce((s, p) => s + p.enrollments, 0);
  const totalRevenueCents30d = timeseries.reduce((s, p) => s + p.revenueCents, 0);

  return (
    <div className="space-y-6">
      {funnel ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entonnoir de conversion</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Du visiteur de la fiche à l&apos;élève qui termine la formation.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Tile
                icon={<TrendingDown className="h-4 w-4" aria-hidden />}
                label="Taux de complétion"
                value={`${funnel.completionRate}%`}
              />
              <Tile
                icon={<Activity className="h-4 w-4" aria-hidden />}
                label="Note moyenne"
                value={
                  funnel.totalRatings > 0
                    ? `${funnel.averageRating.toFixed(1)} (${funnel.totalRatings} avis)`
                    : "—"
                }
              />
            </div>
            <CourseFunnel funnel={funnel} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activité — 30 derniers jours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile
              icon={<Users className="h-4 w-4" aria-hidden />}
              label="Inscriptions"
              value={totalEnrollments30d.toLocaleString("fr-FR")}
            />
            <Tile
              icon={<Activity className="h-4 w-4" aria-hidden />}
              label="Revenu"
              value={`${(totalRevenueCents30d / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} EUR`}
            />
            <Tile
              icon={<Users className="h-4 w-4" aria-hidden />}
              label="Élèves au total"
              value={enrollmentsCount.toLocaleString("fr-FR")}
            />
          </div>
          <CourseInsightsChart data={timeseries} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown
              className="h-5 w-5 text-[color:var(--brand-warning)]"
              aria-hidden
            />
            Dropoff par leçon
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Pour chaque leçon, % d&apos;élèves qui l&apos;ont commencée vs ceux qui
            l&apos;ont terminée. Les drops importants indiquent où réviser le
            contenu.
          </p>
        </CardHeader>
        <CardContent>
          {dropoff.length === 0 || enrollmentsCount === 0 ? (
            <p className="text-sm text-muted-foreground">
              Pas encore d&apos;élèves inscrits pour mesurer l&apos;engagement.
            </p>
          ) : (
            <ul className="space-y-3">
              {dropoff.map((row) => {
                const startedPercent = Math.min(
                  100,
                  Math.round((row.startedCount / enrollmentsCount) * 100),
                );
                const completedPercent = Math.min(
                  100,
                  Math.round((row.completedCount / enrollmentsCount) * 100),
                );
                const dropPercent = startedPercent - completedPercent;
                const isProblematic = startedPercent > 0 && dropPercent > 40;

                return (
                  <li key={row.lessonId} className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <p className="min-w-0 truncate font-medium text-foreground">
                        <span className="text-xs text-muted-foreground">
                          {row.sectionTitle} ·{" "}
                        </span>
                        {row.lessonTitle}
                      </p>
                      <div className="flex items-center gap-3 text-xs tabular-nums">
                        <span className="text-muted-foreground">
                          {row.startedCount} démarré
                        </span>
                        <span className="font-semibold text-foreground">
                          {row.completedCount} terminé ({completedPercent}%)
                        </span>
                        {isProblematic ? (
                          <span className="rounded-full bg-[color:var(--brand-warning)]/15 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--brand-warning)]">
                            ⚠ drop {dropPercent}%
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                      {/* Barre 1 : % démarré (gris foncé) */}
                      <div
                        className="absolute inset-y-0 left-0 bg-[color:var(--brand-secondary)]/30"
                        style={{ width: `${startedPercent}%` }}
                      />
                      {/* Barre 2 : % terminé par-dessus (couleur pleine) */}
                      <div
                        className="absolute inset-y-0 left-0 bg-[color:var(--brand-secondary)]"
                        style={{ width: `${completedPercent}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 text-xl font-semibold text-foreground tabular-nums">
        {value}
      </p>
    </div>
  );
}
