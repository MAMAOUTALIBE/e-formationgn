import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Link2, TrendingUp, Users } from "lucide-react";

import { auth } from "@/auth";
import { CopyAffiliateLink } from "@/components/features/affiliate/copy-affiliate-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Affiliation",
};

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function thirtyDaysAgo() {
  return new Date(Date.now() - 30 * 24 * 3600 * 1000);
}

export default async function InstructorAffiliationPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/formateur/affiliation");
  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    redirect("/devenir-formateur");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      affiliateCode: true,
      coursesAuthored: { select: { id: true } },
    },
  });
  if (!user) redirect("/profil");

  const courseIds = user.coursesAuthored.map((c) => c.id);

  // Statistiques affiliation : clics 30 j, conversions, top cours via lien
  const [clicksTotal, clicks30d, conversions, topCourses] = await Promise.all([
    prisma.affiliateClick.count({ where: { affiliateUserId: session.user.id } }),
    prisma.affiliateClick.count({
      where: { affiliateUserId: session.user.id, createdAt: { gte: thirtyDaysAgo() } },
    }),
    prisma.order.count({
      where: {
        status: "PAID",
        affiliateCode: user.affiliateCode ?? "__none__",
        paidAt: { gte: thirtyDaysAgo() },
      },
    }),
    prisma.affiliateClick.groupBy({
      by: ["courseId"],
      where: {
        affiliateUserId: session.user.id,
        createdAt: { gte: thirtyDaysAgo() },
        courseId: { not: null },
      },
      _count: { _all: true },
      orderBy: { _count: { courseId: "desc" } },
      take: 5,
    }),
  ]);

  const topCoursesDetail = await prisma.course.findMany({
    where: { id: { in: topCourses.map((t) => t.courseId).filter((id): id is string => Boolean(id)) } },
    select: { id: true, title: true, slug: true },
  });

  const baseLink = user.affiliateCode
    ? `${APP_URL}/?ref=${user.affiliateCode}`
    : null;

  // Conversion rate sur les 30 jours (best effort, l'attribution exacte se fait
  // côté Order.affiliateCode, donc seulement les ventes via lien).
  const conversionRate =
    clicks30d > 0 ? ((conversions / clicks30d) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Affiliation
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Recommandez Aiduca avec votre lien personnel. Quand un élève
          achète l&apos;une de vos formations via votre lien, votre taux de commission
          passe à <strong>15 %</strong> au lieu de 30 %.
        </p>
      </header>

      {!user.affiliateCode ? (
        <Card>
          <CardContent className="p-6 text-sm">
            <p className="text-muted-foreground">
              Vous n&apos;avez pas encore de code d&apos;affiliation. Contactez
              l&apos;administration pour qu&apos;un code vous soit attribué.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Votre lien d&apos;affiliation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Code unique
                </p>
                <code className="rounded-md bg-muted px-3 py-1.5 font-mono text-sm">
                  {user.affiliateCode}
                </code>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Lien à partager (page d&apos;accueil)
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    readOnly
                    value={baseLink ?? ""}
                    className="font-mono text-xs"
                  />
                  <CopyAffiliateLink url={baseLink ?? ""} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Vous pouvez aussi pointer vers une formation précise :
                  <br />
                  <code className="break-all">
                    {APP_URL}/cours/&lt;slug&gt;?ref={user.affiliateCode}
                  </code>
                </p>
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Clics ces 30 j"
              value={clicks30d}
              icon={<Link2 className="h-4 w-4" />}
            />
            <KpiCard
              label="Clics cumulés"
              value={clicksTotal}
              icon={<Users className="h-4 w-4" />}
            />
            <KpiCard
              label="Ventes attribuées (30 j)"
              value={conversions}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KpiCard
              label="Taux de conversion"
              value={`${conversionRate} %`}
              icon={<TrendingUp className="h-4 w-4" />}
              hint="ventes / clics"
            />
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top formations via lien (30 j)</CardTitle>
            </CardHeader>
            <CardContent>
              {topCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Pas encore de clics ces 30 derniers jours.
                </p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {topCourses.map((t) => {
                    const course = topCoursesDetail.find((c) => c.id === t.courseId);
                    if (!course) return null;
                    return (
                      <li
                        key={t.courseId}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <span className="truncate font-medium">{course.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t._count._all} clic{t._count._all > 1 ? "s" : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comment ça marche</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">1.</strong> Vous partagez
                  votre lien (réseaux sociaux, blog, newsletter…).
                </li>
                <li>
                  <strong className="text-foreground">2.</strong> Le visiteur
                  arrive avec votre code → il est cookie pendant 30 jours
                  (uniquement pour vos formations).
                </li>
                <li>
                  <strong className="text-foreground">3.</strong> S&apos;il
                  achète l&apos;une de vos formations dans cette fenêtre, la commission
                  plateforme passe à 15 % au lieu de 30 % → vous gagnez plus.
                </li>
                <li>
                  <strong className="text-foreground">4.</strong> Le code n&apos;a
                  pas d&apos;effet sur les formations d&apos;autres formateurs (la
                  commission y reste à 30 %).
                </li>
              </ol>
            </CardContent>
          </Card>
        </>
      )}

      {courseIds.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Vous n&apos;avez pas encore de formation publiée — créez-en une pour que
            votre lien d&apos;affiliation prenne tout son sens.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
