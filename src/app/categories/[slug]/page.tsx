import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { CourseCard } from "@/components/features/courses/course-card";
import { CourseCarousel } from "@/components/features/courses/course-carousel";
import { CourseEmptyState } from "@/components/features/courses/course-empty-state";
import { CourseFilterBar } from "@/components/features/courses/course-filter-bar";
import { CourseMobileFilterBar } from "@/components/features/courses/course-mobile-filter-bar";
import { FilterTransitionProvider } from "@/components/features/courses/filter-transition-context";
import { CourseSearchBar } from "@/components/features/courses/course-search-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { getCourseDomainBackground } from "@/lib/courses/domain-backgrounds";
import { courseFiltersSchema } from "@/lib/validators/courses";
import { getCategoryBySlug, listCategories } from "@/server/queries/categories";
import { getCourseFilterCounts, listPublishedCourses } from "@/server/queries/courses";

const CATALOG_MAX_ITEMS = 200;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Métadonnées d'une ressource absente.
 *
 * Le layout racine déclare `robots: { index: true, follow: true }` pour tout le
 * site. Une page qui ne trouve pas sa ressource en hérite, et se retrouve avec
 * deux directives contradictoires : celle du layout et le `noindex` que Next
 * injecte avec `notFound()`. Google retient la plus restrictive, mais tous les
 * robots ne le garantissent pas — et sur `/cours/[slug]`, dont le segment
 * possède un `loading.tsx`, la réponse part en streaming avec un statut 200 :
 * le `noindex` est alors la seule chose qui empêche l'indexation d'une page
 * fantôme. Il doit donc être affirmé, pas seulement injecté.
 */
const MISSING_ROBOTS = { robots: { index: false, follow: false } } as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Catégorie introuvable", ...MISSING_ROBOTS };
  return {
    title: category.name,
    description:
      category.description ??
      `Toutes les formations de la catégorie ${category.name} sur Aiduca.`,
    alternates: { canonical: `/categories/${category.slug}` },
  };
}

export default async function CategoryDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  // On force le filtre catégorie sur la valeur du segment.
  const filters = courseFiltersSchema.parse({ ...sp, category: slug });
  const session = await auth();
  const currency = session?.user.preferredCurrency ?? "EUR";

  const [{ items, total }, allCategories, filterCounts] = await Promise.all([
    listPublishedCourses({
      filters,
      take: CATALOG_MAX_ITEMS,
      skip: 0,
    }),
    listCategories(),
    getCourseFilterCounts(filters),
  ]);

  const categoryOptions = allCategories.map((c) => ({ slug: c.slug, name: c.name }));
  const heroBackground = getCourseDomainBackground(category.slug);
  const resetKey = JSON.stringify({
    q: filters.q ?? "",
    level: filters.level ?? "",
    price: filters.price ?? "",
    duration: filters.duration ?? "",
    rating: filters.rating ?? "",
    sort: filters.sort ?? "",
  });

  return (
    <>
      <SiteHeader />

      <FilterTransitionProvider>
        <main className="flex-1 bg-muted/20">
          <section className="relative isolate overflow-hidden border-b border-slate-200/70 bg-white">
            {heroBackground ? (
              <Image
                src={heroBackground}
                alt=""
                fill
                priority
                sizes="100vw"
                className="-z-20 object-cover object-center"
              />
            ) : null}
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.92)_38%,rgba(255,255,255,0.52)_62%,rgba(255,255,255,0.10)_100%)]"
            />

            <Container className="space-y-6 py-8 sm:py-12 lg:py-16">
              <Breadcrumbs
                items={[
                  { label: "Accueil", href: "/" },
                  { label: "Catégories", href: "/categories" },
                  { label: category.name },
                ]}
              />

              <header>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                  {category.name}
                </h1>
                {category.description ? (
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                    {category.description}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-muted-foreground">
                  {total.toLocaleString("fr-FR")} {total > 1 ? "formations disponibles" : "formation disponible"}
                </p>
              </header>

              <CourseSearchBar integrated />
            </Container>
          </section>

          <Container className="space-y-6 py-8">
            <CourseFilterBar
              categories={categoryOptions}
              counts={filterCounts}
              hideCategory
              className="hidden sm:flex"
            />

            {items.length === 0 ? (
              <CourseEmptyState
                basePath={`/categories/${slug}`}
                preserveParams={["q"]}
                suggestedCategories={categoryOptions
                  .filter((c) => c.slug !== slug)
                  .slice(0, 6)}
              />
            ) : (
              <CourseCarousel resetKey={resetKey}>
                {items.map((course) => (
                  <CourseCard key={course.id} course={course} currency={currency} />
                ))}
              </CourseCarousel>
            )}
          </Container>
        </main>

        <CourseMobileFilterBar categories={categoryOptions} counts={filterCounts} hideCategory />
      </FilterTransitionProvider>

      <SiteFooter />
    </>
  );
}
