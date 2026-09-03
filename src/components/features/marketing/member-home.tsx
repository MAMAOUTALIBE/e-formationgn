// Page d'accueil PERSONNALISÉE (utilisateur connecté) — façon Udemy :
// reprendre l'apprentissage, recommandations, puis découverte. Pas de héro
// marketing (l'utilisateur est déjà membre).

import { BookOpen, Heart, Search } from "lucide-react";
import Image from "next/image";
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
  const coursesToDiscover = (latest.length > 0 ? latest : recommended).slice(0, 4);
  const hasInProgressCourses = inProgress.length > 0;

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* HERO compact personnalisé */}
        <section className="relative overflow-hidden border-b border-[color:var(--brand-secondary)]/15 py-8 sm:py-10">
          <div aria-hidden className="pointer-events-none absolute -inset-1">
            <Image
              src="/images/member-hero-renewable-ai.webp"
              alt=""
              fill
              priority
              sizes="100vw"
              className="scale-[1.01] object-cover object-center blur-[1px]"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.86) 38%, rgba(255,255,255,0.42) 63%, rgba(255,255,255,0.08) 100%)",
              }}
            />
          </div>

          <Container className="relative z-10">
            <div className="flex max-w-3xl flex-col gap-5">
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
                  placeholder="Rechercher une formation…"
                  aria-label="Rechercher une formation"
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
                {hasInProgressCourses
                  ? "Reprendre l’apprentissage"
                  : "Formations à découvrir"}
              </h2>
              <Link
                href={hasInProgressCourses ? "/apprentissage" : "/cours"}
                className="text-sm font-medium text-[color:var(--brand-secondary)] hover:underline"
              >
                Tout voir →
              </Link>
            </div>

            {hasInProgressCourses ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {inProgress.map((enrollment) => (
                  <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
                ))}
              </div>
            ) : coursesToDiscover.length > 0 ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {coursesToDiscover.map((course) => (
                  <CourseCard key={course.id} course={course} currency="EUR" />
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--brand-secondary)]/30 bg-[color:var(--brand-secondary)]/5 p-5 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--brand-secondary)]/10 text-[color:var(--brand-secondary)]"><BookOpen className="h-5 w-5" aria-hidden /></span>
                <p className="mt-3 text-sm font-medium text-foreground">Votre prochaine compétence commence ici.</p>
                <p className="mt-1 text-sm text-muted-foreground">Le catalogue sera bientôt enrichi de nouvelles formations.</p>
                <Button asChild className="mt-3">
                  <Link href="/cours">Consulter le catalogue</Link>
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
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Explorer par catégorie
              </h2>
              <div
                role="region"
                aria-label="Catégories de formation"
                className="mt-5 flex flex-nowrap gap-4 overflow-x-auto scroll-smooth pb-3 snap-x snap-mandatory overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {categories.map((category, index) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    variant={index}
                    className="w-[85vw] max-w-80 shrink-0 snap-start"
                  />
                ))}
              </div>
              <div className="mt-5 flex justify-center">
                <Button asChild variant="outline" className="rounded-full px-6">
                  <Link href="/categories">Voir toutes les catégories</Link>
                </Button>
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
