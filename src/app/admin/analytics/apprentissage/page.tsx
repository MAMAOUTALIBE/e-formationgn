import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Apprentissage — stats" };

export const dynamic = "force-dynamic";

function thirtyDaysAgo() {
  return new Date(Date.now() - 30 * 24 * 3600 * 1000);
}

export default async function LearningStatsPage() {
  const [
    totalCertificates,
    certificatesThisMonth,
    quizAttempts,
    quizPasses,
    avgScore,
    topQuizzes,
    completionAvg,
  ] = await Promise.all([
    prisma.certificate.count({}),
    prisma.certificate.count({
      where: { issuedAt: { gte: thirtyDaysAgo() } },
    }),
    prisma.quizAttempt.count({
      where: { completedAt: { not: null } },
    }),
    prisma.quizAttempt.count({
      where: { passed: true },
    }),
    prisma.quizAttempt.aggregate({
      _avg: { score: true },
      where: { completedAt: { not: null } },
    }),
    prisma.quizAttempt.groupBy({
      by: ["quizId"],
      where: { completedAt: { not: null } },
      _count: { _all: true },
      _avg: { score: true },
      orderBy: { _count: { quizId: "desc" } },
      take: 10,
    }),
    prisma.enrollment.aggregate({
      _avg: { progressPercent: true },
    }),
  ]);

  const quizIds = topQuizzes.map((q) => q.quizId);
  const quizDetails = await prisma.quiz.findMany({
    where: { id: { in: quizIds } },
    select: {
      id: true,
      title: true,
      passingScore: true,
      lesson: {
        select: {
          section: { select: { course: { select: { id: true, title: true } } } },
        },
      },
    },
  });
  const quizMap = new Map(quizDetails.map((q) => [q.id, q]));

  const passRate =
    quizAttempts > 0 ? ((quizPasses / quizAttempts) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Statistiques apprentissage
        </h1>
        <p className="text-sm text-muted-foreground">
          Engagement des élèves : quiz, certificats, taux de complétion.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Certificats émis" value={totalCertificates} />
        <KpiCard label="Certificats (30 j)" value={certificatesThisMonth} />
        <KpiCard label="Tentatives quiz" value={quizAttempts} />
        <KpiCard
          label="Taux de réussite quiz"
          value={`${passRate} %`}
          hint="passes / tentatives"
        />
        <KpiCard
          label="Score moyen quiz"
          value={(avgScore._avg.score ?? 0).toFixed(1)}
          hint="sur 100"
        />
        <KpiCard
          label="Complétion moyenne"
          value={`${(completionAvg._avg.progressPercent ?? 0).toFixed(1)} %`}
          hint="toutes inscriptions"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 quiz les plus passés</CardTitle>
        </CardHeader>
        <CardContent>
          {topQuizzes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune tentative pour l&apos;instant.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {topQuizzes.map((q) => {
                const detail = quizMap.get(q.quizId);
                return (
                  <li
                    key={q.quizId}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {detail?.title ?? "(quiz supprimé)"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {detail?.lesson.section.course.title ?? "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <p className="font-medium">{q._count._all} tentatives</p>
                      <p className="text-muted-foreground">
                        Moy {(q._avg.score ?? 0).toFixed(0)} / 100 ·
                        Seuil {detail?.passingScore ?? 70}
                      </p>
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
