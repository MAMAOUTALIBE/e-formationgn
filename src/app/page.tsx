import Link from "next/link";
import {
  Award,
  GraduationCap,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import { auth } from "@/auth";
import { CategoryCard } from "@/components/features/courses/category-card";
import { CategoryTabs } from "@/components/features/courses/category-tabs";
import { CourseCard } from "@/components/features/courses/course-card";
import { CourseCarousel } from "@/components/features/courses/course-carousel";
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
import { getPublicStats } from "@/server/queries/stats";

export default async function HomePage() {
  const session = await auth();
  const currency = session?.user ? "EUR" : "EUR";
  const { locale, t } = await getDictionary();

  const [featuredCategories, featuredCourses, latestCourses, stats] =
    await Promise.all([
      listFeaturedCategories(8),
      listFeaturedCourses(8),
      listLatestCourses(8),
      getPublicStats(),
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
        {/* HERO — gradient violet façon Udemy avec card blanche compacte */}
        <section className="py-6 md:py-8">
          <Container>
            <div className="relative overflow-hidden rounded-3xl">
              <div
                aria-hidden
                className="absolute inset-0 -z-10 bg-gradient-to-br from-[color:var(--brand-primary)] via-[color:var(--brand-violet-deep)] to-[color:var(--brand-violet)]"
              />
              <div
                aria-hidden
                className="absolute inset-0 -z-10 opacity-40"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.18) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(14,165,233,0.3) 0%, transparent 50%)",
                }}
              />
              {/* Forme décorative type Udemy — grand "U" stylisé en arrière-plan */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-32 top-1/2 hidden h-[140%] w-[60%] -translate-y-1/2 lg:block"
                style={{
                  background:
                    "radial-gradient(ellipse at center, rgba(255,255,255,0.08) 0%, transparent 60%)",
                }}
              />

              <div className="grid items-center gap-8 px-6 py-10 sm:px-10 md:grid-cols-[minmax(0,480px)_1fr] md:py-12 lg:px-14">
                {/* CARD BLANCHE COMPACTE À GAUCHE */}
                <div className="relative rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 sm:p-7">
                  <Badge
                    variant="secondary"
                    className="mb-4 bg-[color:var(--brand-violet)]/10 text-[color:var(--brand-violet-deep)] hover:bg-[color:var(--brand-violet)]/15"
                  >
                    <Sparkles className="mr-1 h-3 w-3" aria-hidden />
                    {t.hero.badge}
                  </Badge>
                  <h1 className="text-2xl font-bold leading-[1.1] tracking-tight text-[color:var(--neutral-900)] sm:text-3xl md:text-4xl">
                    {t.hero.headline1}{" "}
                    <span className="text-[color:var(--brand-violet-deep)]">
                      {t.hero.headline2}
                    </span>
                  </h1>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    {t.hero.description}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Button
                      asChild
                      className="bg-[color:var(--brand-mint)] text-[color:var(--neutral-900)] shadow-md hover:bg-[color:var(--brand-mint-deep)]"
                    >
                      <Link href="/cours">{t.hero.ctaPrimary}</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/devenir-formateur">{t.hero.ctaSecondary}</Link>
                    </Button>
                  </div>
                </div>

                {/* ILLUSTRATION À DROITE — cards flottantes type Udemy */}
                <div className="relative hidden h-[320px] md:block">
              {/* Halo décoratif */}
              <div
                aria-hidden
                className="absolute inset-0 rounded-full opacity-30 blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle, rgba(14,165,233,0.6) 0%, transparent 70%)",
                }}
              />

              {/* Card 1 — graph */}
              <HeroFloatingCard
                className="absolute right-8 top-2 rotate-3 bg-white"
                size="lg"
              >
                <div className="flex h-full w-full items-center justify-center">
                  <ChartIllustration />
                </div>
              </HeroFloatingCard>

              {/* Card 2 — bouclier (sécurité / certification) */}
              <HeroFloatingCard
                className="absolute left-4 top-32 -rotate-6 bg-white"
                size="md"
              >
                <div className="flex h-full w-full items-center justify-center">
                  <Award
                    className="h-12 w-12 text-[color:var(--brand-violet-deep)]"
                    aria-hidden
                  />
                </div>
              </HeroFloatingCard>

              {/* Card 3 — étoile / IA (accent menthe) */}
              <HeroFloatingCard
                className="absolute bottom-6 right-12 rotate-2 bg-[color:var(--brand-mint)]"
                size="md"
              >
                <div className="flex h-full w-full items-center justify-center">
                  <Sparkles
                    className="h-12 w-12 text-[color:var(--neutral-900)]"
                    aria-hidden
                  />
                </div>
              </HeroFloatingCard>

              {/* Pastille stat compacte */}
              <div className="absolute bottom-8 left-0 flex items-center gap-3 rounded-full bg-white/95 px-4 py-3 shadow-xl ring-1 ring-black/5 backdrop-blur-sm">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--brand-mint)]">
                  <Users
                    className="h-4 w-4 text-[color:var(--neutral-900)]"
                    aria-hidden
                  />
                </div>
                <div>
                  <p className="text-base font-bold leading-none text-[color:var(--neutral-900)]">
                    {stats.totalStudents.toLocaleString(locale === "en" ? "en-US" : "fr-FR")}+
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.hero.activeStudents}
                  </p>
                </div>
              </div>
            </div>
              </div>
            </div>
          </Container>
        </section>

        {/* TRUST BAR — stats sur fond clair, juste sous le hero */}
        <section className="border-b border-border bg-muted/40 py-8">
          <Container>
            <div className="grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
              <CompactStat value={stats.totalStudents} label="élèves" />
              <CompactStat value={stats.totalInstructors} label="formateurs" />
              <CompactStat value={stats.totalCourses} label="cours" />
              <CompactStat value={stats.totalCategories} label="catégories" />
            </div>
          </Container>
        </section>

        {/* TRUSTED BY — bande logos d'entreprises */}
        <HomeTrustedBy />

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
                  Des cours essentiels aux sujets techniques de pointe.
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
                  Les cours les plus populaires
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

              <div className="relative grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-center">
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

                {/* Illustration : 3 cards flottantes */}
                <div className="relative hidden md:block">
                  <FloatingCard
                    className="absolute right-0 top-0 rotate-3 bg-gradient-to-br from-[#7c3aed] to-[#5b21b6]"
                    icon={<Sparkles className="h-8 w-8" />}
                  />
                  <FloatingCard
                    className="absolute right-24 top-24 -rotate-6 bg-gradient-to-br from-[#0ea5e9] to-[#2563eb]"
                    icon={<Award className="h-8 w-8" />}
                  />
                  <FloatingCard
                    className="absolute right-8 top-48 rotate-2 bg-gradient-to-br from-[#1e3a8a] to-[#0ea5e9]"
                    icon={<GraduationCap className="h-8 w-8" />}
                  />
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
                    Les cours fraîchement mis en ligne.
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
                Créez votre cours, fixez votre prix, touchez une audience
                francophone engagée. Bénéficiez d&apos;un taux préférentiel à
                15% sur les ventes générées via votre lien d&apos;affiliation.
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

function HeroFloatingCard({
  children,
  className,
  size = "md",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "md" | "lg";
}) {
  const dims = size === "lg" ? "h-44 w-56" : "h-36 w-36";
  return (
    <div
      className={`${dims} overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function ChartIllustration() {
  return (
    <svg
      viewBox="0 0 220 140"
      className="h-full w-full p-4"
      aria-hidden
    >
      <defs>
        <linearGradient id="chart-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#5b21b6" />
        </linearGradient>
      </defs>
      <rect x="20" y="80" width="22" height="40" rx="4" fill="url(#chart-grad)" opacity="0.55" />
      <rect x="55" y="60" width="22" height="60" rx="4" fill="url(#chart-grad)" opacity="0.7" />
      <rect x="90" y="40" width="22" height="80" rx="4" fill="url(#chart-grad)" opacity="0.85" />
      <rect x="125" y="25" width="22" height="95" rx="4" fill="url(#chart-grad)" />
      <rect x="160" y="10" width="22" height="110" rx="4" fill="#92f6a1" />
      <path
        d="M 28 90 L 65 70 L 100 50 L 135 35 L 170 20"
        stroke="#6ce382"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="170" cy="20" r="4" fill="#6ce382" />
    </svg>
  );
}

function CompactStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-2xl font-bold tracking-tight text-foreground">
        {value.toLocaleString("fr-FR")}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
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

function FloatingCard({
  icon,
  className,
}: {
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex h-32 w-32 items-center justify-center rounded-2xl text-white shadow-2xl ring-1 ring-white/20 ${className ?? ""}`}
    >
      {icon}
    </div>
  );
}
