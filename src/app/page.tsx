import type { Metadata } from "next";
import Link from "next/link";
import { Award, Search, Sparkles, Target, Users } from "lucide-react";

import { auth } from "@/auth";
import { CategoryCard } from "@/components/features/courses/category-card";
import { CategoryTabs } from "@/components/features/courses/category-tabs";
import { CourseCard } from "@/components/features/courses/course-card";
import { CourseCarousel } from "@/components/features/courses/course-carousel";
import { HeroTechBackground } from "@/components/features/marketing/hero-tech-bg";
import {
  FeaturedInstructors,
  HowItWorks,
  WhyGandal,
} from "@/components/features/marketing/home-sections";
import { MemberHome } from "@/components/features/marketing/member-home";
import { HomeTestimonials } from "@/components/features/marketing/testimonials";
import { HomeTrustedBy } from "@/components/features/marketing/trusted-by";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getDictionary } from "@/lib/i18n/server";
import { listFeaturedCategories } from "@/server/queries/categories";
import {
  listCoursesByCategorySlugs,
  listFeaturedCourses,
  listLatestCourses,
} from "@/server/queries/courses";
import { listFeaturedInstructors } from "@/server/queries/instructors-public";
import { getPublicStats } from "@/server/queries/stats";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    languages: {
      "fr-FR": "/",
      "fr-BE": "/",
      "fr-CA": "/",
      "fr-CI": "/",
      "fr-SN": "/",
      "fr-GN": "/",
      "x-default": "/",
    },
  },
};

export default async function HomePage() {
  const session = await auth();

  // Accueil personnalisé pour les membres connectés (reprendre l'apprentissage,
  // recommandations…) ; page marketing pour les visiteurs.
  if (session?.user) {
    return <MemberHome userId={session.user.id} userName={session.user.name ?? null} />;
  }

  const currency = "EUR";
  const { t } = await getDictionary();

  const [featuredCategories, featuredCourses, latestCourses, stats, featuredInstructors] =
    await Promise.all([
      listFeaturedCategories(8),
      listFeaturedCourses(8),
      listLatestCourses(8),
      getPublicStats(),
      listFeaturedInstructors(4),
    ]);

  const tabCategories = featuredCategories.slice(0, 5);
  const coursesByCategorySlug = await listCoursesByCategorySlugs(
    tabCategories.map((cat) => cat.slug),
    8,
  );
  const coursesByTab = tabCategories.map((cat) => coursesByCategorySlug[cat.slug] ?? []);

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        {/* HERO — search-first marketplace (gradient on-brand, recherche centrale) */}
        <section className="py-6 md:py-8">
          <Container>
            <div className="relative overflow-hidden rounded-3xl px-6 py-10 text-center sm:px-10 md:py-12">
              <HeroTechBackground />

              <div className="relative mx-auto max-w-3xl">
                <Badge
                  variant="secondary"
                  className="mb-4 border-white/20 bg-white/10 text-white hover:bg-white/15"
                >
                  <Sparkles className="mr-1 h-3 w-3" aria-hidden />
                  {t.hero.badge}
                </Badge>

                <h1 className="text-balance text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl md:text-5xl">
                  {t.hero.headline1}{" "}
                  <span className="mt-1 block text-[color:var(--brand-mint)]">
                    {t.hero.headline2}
                  </span>
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-sm text-white/85 sm:text-base">
                  {t.hero.description}
                </p>

                {/* RECHERCHE — formulaire GET natif vers /cours?q=… */}
                <form
                  action="/cours"
                  role="search"
                  className="mx-auto mt-6 flex max-w-2xl items-center gap-2 rounded-full bg-white p-2 shadow-2xl ring-1 ring-black/5"
                >
                  <Search className="ml-3 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  <input
                    type="search"
                    name="q"
                    placeholder="Que voulez-vous apprendre ? (ex : Python, design, marketing…)"
                    aria-label="Rechercher une formation"
                    className="min-w-0 flex-1 bg-transparent py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground sm:text-base"
                  />
                  <Button
                    type="submit"
                    className="shrink-0 rounded-full bg-[color:var(--brand-mint)] px-5 text-[color:var(--neutral-900)] hover:bg-[color:var(--brand-mint-deep)]"
                  >
                    Rechercher
                  </Button>
                </form>

                {/* PUCES CATÉGORIES populaires */}
                {featuredCategories.length > 0 ? (
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    <span className="text-sm text-white/70">Populaire :</span>
                    {featuredCategories.slice(0, 6).map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/categories/${cat.slug}`}
                        className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-white/20"
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                ) : null}

                {/* Signaux de confiance (qualitatifs — pas de compteurs faibles) */}
                <p className="mt-5 text-sm text-white/75">
                  {stats.totalCourses}+ formations · {stats.totalCategories} catégories ·
                  Formateurs francophones · Certificat à la clé
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* TRUSTED BY — preuve sociale immédiate, juste sous le hero */}
        <HomeTrustedBy />

        {/* COURS POPULAIRES — vrais cours, juste sous le hero */}
        {featuredCourses.length > 0 ? (
          <section className="py-9">
            <Container>
              <div className="flex items-end justify-between gap-4">
                <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  Les plus populaires
                </h2>
                <Link
                  href="/cours?sort=popular"
                  className="text-sm font-medium text-[color:var(--brand-secondary)] hover:underline"
                >
                  Voir tout →
                </Link>
              </div>
              <div className="mt-5">
                <CourseCarousel>
                  {featuredCourses.map((course) => (
                    <CourseCard key={course.id} course={course} currency={currency} />
                  ))}
                </CourseCarousel>
              </div>
            </Container>
          </section>
        ) : null}

        {/* COMMENT ÇA MARCHE — 3 étapes */}
        <HowItWorks />

        {/* CATÉGORIES — grille dense */}
        {featuredCategories.length > 0 ? (
          <section className="bg-muted/30 py-10">
            <Container>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    Explorer par catégorie
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Trouvez le domaine qui vous fera progresser.
                  </p>
                </div>
                <Link
                  href="/categories"
                  className="hidden text-sm font-medium text-[color:var(--brand-secondary)] hover:underline sm:inline"
                >
                  Voir tout →
                </Link>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {featuredCategories.map((category, index) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    variant={index}
                  />
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        {/* COURS POPULAIRES — onglets par catégorie */}
        {tabCategories.length > 0 && coursesByTab.some((c) => c.length > 0) ? (
          <section className="py-8">
            <Container>
              <div className="mx-auto max-w-5xl text-center">
                <h2 className="text-lg font-bold tracking-tight text-foreground sm:whitespace-nowrap sm:text-xl md:text-2xl lg:text-3xl xl:text-[2rem]">
                  Des compétences pour révolutionner votre carrière
                </h2>
                <p className="mt-2 text-base text-muted-foreground">
                  Des formations essentielles aux sujets techniques de pointe.
                </p>
              </div>

              <div className="mt-6">
                <CategoryTabs
                  tabs={tabCategories
                    .map((cat, index) => {
                      const courses = coursesByTab[index];
                      if (courses.length === 0) return null;
                      return {
                        slug: cat.slug,
                        label: cat.name,
                        content: (
                          <CourseCarousel>
                            {courses.map((course) => (
                              <CourseCard
                                key={course.id}
                                course={course}
                                currency={currency}
                              />
                            ))}
                          </CourseCarousel>
                        ),
                      };
                    })
                    .filter((tab): tab is NonNullable<typeof tab> => tab !== null)}
                />
              </div>
            </Container>
          </section>
        ) : featuredCourses.length > 0 ? (
          /* Fallback si aucune catégorie n'a de cours : on garde la grille populaires */
          <section className="py-10 md:py-14">
            <Container>
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Les formations les plus populaires
                </h2>
                <p className="mt-3 text-base text-muted-foreground">
                  Une sélection plébiscitée par notre communauté.
                </p>
              </div>

              <div className="mt-6">
                <CourseCarousel>
                  {featuredCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      currency={currency}
                    />
                  ))}
                </CourseCarousel>
              </div>
            </Container>
          </section>
        ) : null}

        {/* POURQUOI GANDAL — grille d'atouts */}
        <WhyGandal />

        {/* FORMATEURS EN VEDETTE */}
        <FeaturedInstructors instructors={featuredInstructors} />

        {/* DARK BLOCK — Réinventez votre carrière */}
        <section className="py-10 md:py-14">
          <Container>
            <div className="relative overflow-hidden rounded-2xl bg-[color:var(--neutral-900)] p-8 md:p-12 lg:p-16">
              <div
                aria-hidden
                className="absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 80% 20%, rgba(124,58,237,0.4) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(37,99,235,0.3) 0%, transparent 50%)",
                }}
              />

              <div className="relative max-w-2xl">
                <div className="text-white">
                  <Badge
                    variant="secondary"
                    className="mb-4 border-white/20 bg-white/10 text-white"
                  >
                    Abonnement individuel
                  </Badge>
                  <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                    Réinventez votre carrière à l&apos;ère du numérique
                  </h2>
                  <p className="mt-4 max-w-lg text-white/80">
                    Pérennisez vos compétences avec un accès illimité à notre
                    catalogue. Apprenez auprès des meilleurs formateurs
                    francophones et préparez votre certification.
                  </p>

                  <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                    <Bullet
                      icon={<Sparkles className="h-4 w-4" />}
                      label="Apprenez l'IA et bien plus"
                    />
                    <Bullet
                      icon={<Award className="h-4 w-4" />}
                      label="Préparez vos certifications"
                    />
                    <Bullet
                      icon={<Target className="h-4 w-4" />}
                      label="Évoluez dans votre carrière"
                    />
                    <Bullet
                      icon={<Users className="h-4 w-4" />}
                      label="Communauté francophone active"
                    />
                  </ul>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button
                      asChild
                      size="lg"
                      className="bg-[color:var(--brand-mint)] text-[color:var(--neutral-900)] hover:bg-[color:var(--brand-mint-deep)]"
                    >
                      <Link href="/cours">Commencer maintenant</Link>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                    >
                      <Link href="/a-propos">En savoir plus</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* NOUVEAUTÉS */}
        {latestCourses.length > 0 ? (
          <section className="border-t border-border bg-muted/30 py-10">
            <Container>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    Dernières nouveautés
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Les formations fraîchement mises en ligne.
                  </p>
                </div>
                <Link
                  href="/cours?sort=newest"
                  className="hidden text-sm font-medium text-[color:var(--brand-secondary)] hover:underline sm:inline"
                >
                  Voir tout →
                </Link>
              </div>

              <div className="mt-6">
                <CourseCarousel>
                  {latestCourses.map((course) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      currency={currency}
                    />
                  ))}
                </CourseCarousel>
              </div>
            </Container>
          </section>
        ) : null}

        {/* TESTIMONIALS — preuve sociale juste avant le CTA formateur */}
        <HomeTestimonials />

        {/* DEVENIR FORMATEUR */}
        <section className="border-t border-border bg-gradient-to-br from-[color:var(--brand-primary)] via-[color:var(--brand-violet-deep)] to-[color:var(--brand-violet)] py-12 text-white">
          <Container className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                Partagez votre expertise
              </h2>
              <p className="mt-3 text-base text-white/85">
                Créez des formations structurées, accompagnez les apprenants et
                suivez leur progression dans un espace pédagogique complet.
              </p>
            </div>
            <div className="md:justify-self-end">
              <Button
                asChild
                size="lg"
                className="bg-[color:var(--brand-mint)] text-[color:var(--neutral-900)] hover:bg-[color:var(--brand-mint-deep)]"
              >
                <Link href="/devenir-formateur">Devenir formateur</Link>
              </Button>
            </div>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function Bullet({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-violet)]/20 text-[color:var(--brand-violet)] ring-1 ring-[color:var(--brand-violet)]/40">
        {icon}
      </span>
      <span className="text-sm text-white/90">{label}</span>
    </li>
  );
}
