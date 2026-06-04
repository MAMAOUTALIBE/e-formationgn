// Page d'accueil PERSONNALISÉE (utilisateur connecté) — façon Udemy :
// reprendre l'apprentissage, recommandations, puis découverte. Pas de héro
// marketing (l'utilisateur est déjà membre).

import { BookOpen, Heart, Search } from "lucide-react";
import Link from "next/link";

import { CategoryCard } from "@/components/features/courses/category-card";
import { CourseCard } from "@/components/features/courses/course-card";
import { CourseCarousel } from "@/components/features/courses/course-carousel";
import { EnrollmentCard } from "@/components/features/learning/enrollment-card";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { listFeaturedCategories } from "@/server/queries/categories";
import { listLatestCourses } from "@/server/queries/courses";
import {
  listInProgressEnrollments,
  listRecommendedCourseCards,
} from "@/server/queries/member-home";

interface MemberHomeProps {
  userId: string;
  userName: string | null;
}

export async function MemberHome({ userId, userName }: MemberHomeProps) {
  const firstName = (userName ?? "").trim().split(" ")[0] || null;

  const [inProgress, recommended, categories, latest] = await Promise.all([
    listInProgressEnrollments(userId, 4),
    listRecommendedCourseCards(userId, 8),
    listFeaturedCategories(8),
    listLatestCourses(8),
  ]);

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* HERO compact personnalisé */}
        <section className="border-b border-border bg-muted/30 py-8">
          <Container>
            <div className="flex flex-col gap-5">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Bonjour{firstName ? ` ${firstName}` : ""} 👋
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {inProgress.length > 0
                    ? "Reprenez là où vous vous êtes arrêté."
                    : "Prêt à apprendre quelque chose de nouveau aujourd'hui ?"}
                </p>
              </div>

              <form
                action="/cours"
                role="search"
                className="flex max-w-2xl items-center gap-2 rounded-full border border-border bg-card p-1.5 shadow-sm"
              >
                <Search className="ml-2.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  type="search"
                  name="q"
                  placeholder="Rechercher un cours…"
                  aria-label="Rechercher un cours"
                  className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <Button type="submit" size="sm" className="shrink-0 rounded-full">
                  Rechercher
                </Button>
              </form>

              <div className="flex flex-wrap gap-2">
                <QuickLink href="/apprentissage" icon={<BookOpen className="h-4 w-4" />}>
                  Mon apprentissage
                </QuickLink>
                <QuickLink href="/cours" icon={<Search className="h-4 w-4" />}>
                  Parcourir le catalogue
                </QuickLink>
                <QuickLink href="/wishlist" icon={<Heart className="h-4 w-4" />}>
                  Ma liste de souhaits
                </QuickLink>
              </div>
            </div>
          </Container>
        </section>

        {/* REPRENDRE L'APPRENTISSAGE */}
        <section className="py-9">
          <Container>
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Reprendre l&apos;apprentissage
              </h2>
              <Link
                href="/apprentissage"
                className="text-sm font-medium text-[color:var(--brand-secondary)] hover:underline"
              >
                Tout voir →
              </Link>
            </div>

            {inProgress.length > 0 ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {inProgress.map((enrollment) => (
                  <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Vous n&apos;avez pas encore commencé de cours.
                </p>
                <Button asChild className="mt-3">
                  <Link href="/cours">Découvrir un premier cours</Link>
                </Button>
              </div>
            )}
          </Container>
        </section>

        {/* RECOMMANDÉ POUR VOUS */}
        {recommended.length > 0 ? (
          <section className="border-t border-border bg-muted/30 py-9">
            <Container>
              <div className="flex items-end justify-between gap-4">
                <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  Recommandé pour vous
                </h2>
                <Link
                  href="/cours"
                  className="text-sm font-medium text-[color:var(--brand-secondary)] hover:underline"
                >
                  Voir plus →
                </Link>
              </div>
              <div className="mt-5">
                <CourseCarousel>
                  {recommended.map((course) => (
                    <CourseCard key={course.id} course={course} currency="EUR" />
                  ))}
                </CourseCarousel>
              </div>
            </Container>
          </section>
        ) : null}

        {/* EXPLORER PAR CATÉGORIE */}
        {categories.length > 0 ? (
          <section className="py-9">
            <Container>
              <div className="flex items-end justify-between gap-4">
                <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  Explorer par catégorie
                </h2>
                <Link
                  href="/categories"
                  className="text-sm font-medium text-[color:var(--brand-secondary)] hover:underline"
                >
                  Tout voir →
                </Link>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {categories.map((category, index) => (
                  <CategoryCard key={category.id} category={category} variant={index} />
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        {/* NOUVEAUTÉS */}
        {latest.length > 0 ? (
          <section className="border-t border-border bg-muted/30 py-9">
            <Container>
              <div className="flex items-end justify-between gap-4">
                <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  Dernières nouveautés
                </h2>
                <Link
                  href="/cours?sort=newest"
                  className="text-sm font-medium text-[color:var(--brand-secondary)] hover:underline"
                >
                  Tout voir →
                </Link>
              </div>
              <div className="mt-5">
                <CourseCarousel>
                  {latest.map((course) => (
                    <CourseCard key={course.id} course={course} currency="EUR" />
                  ))}
                </CourseCarousel>
              </div>
            </Container>
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}

function QuickLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-[color:var(--brand-secondary)] hover:text-[color:var(--brand-secondary)]"
    >
      {icon}
      {children}
    </Link>
  );
}
