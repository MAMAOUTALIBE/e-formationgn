import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpenText,
  FileText,
  Plus,
  ShoppingBag,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { auth } from "@/auth";
import { CourseStatusBadge } from "@/components/features/instructor/course-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { pluralize } from "@/lib/format/labels";
import { formatMinor } from "@/lib/payments/currency";
import { prisma } from "@/lib/prisma";
import {
  getInstructorDashboardStats,
  getInstructorRevenueOverview,
  listInstructorCourses,
} from "@/server/queries/instructor";
import type { Currency } from "@/generated/prisma/enums";

export const metadata: Metadata = {
  title: "Tableau de bord formateur",
};

export default async function InstructorDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/formateur");

  const [stats, courses, currentUser, revenue] = await Promise.all([
    getInstructorDashboardStats(session.user.id),
    listInstructorCourses(session.user.id),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { affiliateCode: true, firstName: true },
    }),
    getInstructorRevenueOverview(session.user.id),
  ]);

  const recentCourses = courses.slice(0, 5);
  const greetingName = currentUser?.firstName ?? "";

  return (
    <div className="space-y-8">
      <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Bonjour {greetingName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Voici un aperçu de votre activité de formateur.
          </p>
        </div>
        <Button asChild>
          <Link href="/formateur/cours/nouveau">
            <Plus className="h-4 w-4" />
            Nouveau cours
          </Link>
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<BookOpenText className="h-4 w-4" aria-hidden />}
          label="Cours créés"
          value={stats.totalCourses.toLocaleString("fr-FR")}
          hint={`${stats.publishedCourses} publié${stats.publishedCourses > 1 ? "s" : ""} · ${stats.draftCourses} brouillon${stats.draftCourses > 1 ? "s" : ""}`}
        />
        <StatCard
          icon={<Users className="h-4 w-4" aria-hidden />}
          label="Élèves inscrits"
          value={stats.totalEnrollments.toLocaleString("fr-FR")}
          hint={pluralize(stats.totalEnrollments, "inscription")}
        />
        <StatCard
          icon={<Star className="h-4 w-4" aria-hidden />}
          label="Note moyenne"
          value={
            stats.averageRating !== null && stats.totalReviews > 0
              ? stats.averageRating.toFixed(1)
              : "—"
          }
          hint={`${stats.totalReviews.toLocaleString("fr-FR")} ${pluralize(stats.totalReviews, "avis")}`}
        />
        <StatCard
          icon={<FileText className="h-4 w-4" aria-hidden />}
          label="En modération"
          value={stats.pendingReviewCourses.toLocaleString("fr-FR")}
          hint="Cours en attente de validation"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Vos cours récents</CardTitle>
              <CardDescription>Les cinq derniers cours mis à jour.</CardDescription>
            </div>
            <Button asChild variant="link" size="sm" className="h-auto px-0">
              <Link href="/formateur/cours">Voir tout</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentCourses.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                Vous n&apos;avez pas encore créé de cours.{" "}
                <Link
                  href="/formateur/cours/nouveau"
                  className="text-[color:var(--brand-secondary)] hover:underline"
                >
                  Créer mon premier cours
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentCourses.map((course) => (
                  <li key={course.id} className="flex items-center justify-between py-3">
                    <Link
                      href={`/formateur/cours/${course.id}`}
                      className="min-w-0 flex-1 hover:underline"
                    >
                      <p className="truncate text-sm font-medium text-foreground">
                        {course.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {course.category.name} · {course._count.enrollments}{" "}
                        {pluralize(course._count.enrollments, "élève")}
                      </p>
                    </Link>
                    <CourseStatusBadge status={course.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lien d&apos;affiliation</CardTitle>
            <CardDescription>Ventes via ce lien : commission à 15&nbsp;%.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentUser?.affiliateCode ? (
              <code className="block break-all rounded-md border border-border bg-muted px-3 py-2 text-xs">
                {process.env.NEXT_PUBLIC_APP_URL ?? "https://gandal.gn"}
                ?ref={currentUser.affiliateCode}
              </code>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun code d&apos;affiliation pour le moment. Activez votre compte
                formateur depuis la page dédiée.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Partagez ce lien sur vos réseaux et auprès de votre audience pour
              bénéficier du taux préférentiel à 15&nbsp;% au lieu de 30&nbsp;%.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Revenus — section analytics financière (remplace l'ancienne carte
          "Phase 4" maintenant que Stripe est actif). */}
      <section
        aria-labelledby="revenue-heading"
        className="space-y-4 rounded-xl border border-border bg-card p-5"
      >
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="revenue-heading"
              className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground"
            >
              <Wallet className="h-5 w-5 text-[color:var(--brand-primary)]" aria-hidden />
              Revenus
            </h2>
            <p className="text-xs text-muted-foreground">
              Part nette qui vous revient (après commission plateforme). Les
              versements se font le 5 de chaque mois via Stripe Connect.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/formateur/paiements">
              Détails paiements →
            </Link>
          </Button>
        </header>

        {revenue.salesCount === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            Aucune vente pour le moment. Publiez un cours et partagez votre
            lien d&apos;affiliation pour démarrer.
          </div>
        ) : (
          <>
            {/* Tuiles : revenu mois + revenu all-time + ventes mois + ventes all-time */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <RevenueTile
                icon={<TrendingUp className="h-4 w-4" aria-hidden />}
                label="Revenu ce mois"
                amounts={revenue.payoutThisMonthByCurrency}
              />
              <RevenueTile
                icon={<Wallet className="h-4 w-4" aria-hidden />}
                label="Revenu total"
                amounts={revenue.payoutByCurrency}
              />
              <StatCard
                icon={<ShoppingBag className="h-4 w-4" aria-hidden />}
                label="Ventes ce mois"
                value={revenue.salesThisMonthCount.toLocaleString("fr-FR")}
                hint={pluralize(revenue.salesThisMonthCount, "vente")}
              />
              <StatCard
                icon={<ShoppingBag className="h-4 w-4" aria-hidden />}
                label="Ventes totales"
                value={revenue.salesCount.toLocaleString("fr-FR")}
                hint={`Depuis l'inscription`}
              />
            </div>

            {/* Top cours par revenu */}
            {revenue.topCourses.length > 0 ? (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Top cours par revenu
                </h3>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {revenue.topCourses.map((c, index) => (
                    <li
                      key={c.courseId}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-primary)]/10 text-xs font-semibold text-[color:var(--brand-primary)]">
                          {index + 1}
                        </span>
                        <Link
                          href={`/cours/${c.slug}`}
                          className="min-w-0 flex-1 truncate font-medium text-foreground hover:underline"
                        >
                          {c.title}
                        </Link>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold tabular-nums text-foreground">
                          {formatMinor(c.payoutCents, c.currency)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.salesCount} {pluralize(c.salesCount, "vente")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

interface RevenueTileProps {
  icon: React.ReactNode;
  label: string;
  amounts: Record<Currency, number>;
}

function RevenueTile({ icon, label, amounts }: RevenueTileProps) {
  // Affiche jusqu'à 2 devises principales (les plus élevées) — empilées
  // verticalement. Si aucune devise n'a de revenu, on affiche "—".
  const sorted = (Object.entries(amounts) as Array<[Currency, number]>)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        {sorted.length === 0 ? (
          <p className="mt-2 text-2xl font-semibold text-foreground">—</p>
        ) : (
          <div className="mt-2 space-y-1">
            {sorted.map(([currency, amount]) => (
              <p
                key={currency}
                className="text-2xl font-semibold tabular-nums text-foreground"
              >
                {formatMinor(amount, currency)}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}

function StatCard({ icon, label, value, hint }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
