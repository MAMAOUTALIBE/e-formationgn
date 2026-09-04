import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { auth } from "@/auth";
import { CourseEmptyState } from "@/components/features/courses/course-empty-state";
import { CourseFilterBar } from "@/components/features/courses/course-filter-bar";
import { CourseFilterSidebar } from "@/components/features/courses/course-filter-sidebar";
import { CourseResultsArea } from "@/components/features/courses/course-results-area";
import { FilterTransitionProvider } from "@/components/features/courses/filter-transition-context";
import { CourseMobileFilterBar } from "@/components/features/courses/course-mobile-filter-bar";
import { CourseSearchBar } from "@/components/features/courses/course-search-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { listCategories } from "@/server/queries/categories";
import { getCourseFilterCounts, listPublishedCourses } from "@/server/queries/courses";
import { COURSES_PER_PAGE, courseFiltersSchema } from "@/lib/validators/courses";

export const metadata: Metadata = {
  title: "Catalogue des formations",
  description:
    "Découvrez les formations professionnelles proposées par Aiduca et trouvez le parcours adapté à vos objectifs.",
  alternates: { canonical: "/cours" },
  openGraph: {
    url: "/cours",
    title: "Catalogue des formations · Aiduca",
    description: "Découvrez les formations professionnelles proposées par Aiduca.",
  },
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CoursesCatalogPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = courseFiltersSchema.parse(params);
  const showAll = filters.view === "all";
  const session = await auth();
  const currency = session?.user.preferredCurrency ?? "EUR";

  const [{ items, total }, categories, filterCounts] =
    await Promise.all([
      listPublishedCourses({
        filters,
        take: showAll ? null : COURSES_PER_PAGE,
        skip: showAll ? 0 : (filters.page - 1) * COURSES_PER_PAGE,
      }),
      listCategories(),
      getCourseFilterCounts(filters),
    ]);

  const categoryOptions = categories.map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <>
      <SiteHeader />

      {/* Un seul FilterTransitionProvider wrappe main + mobile bottom bar :
          le pending state se propage à tous les filtres (sidebar desktop,
          top bar tablette, drawer + tri mobile) et à la zone résultats. */}
      <FilterTransitionProvider>
        <main className="flex-1 bg-muted/20">
          <section className="relative isolate overflow-hidden border-b border-slate-200/70 bg-white">
            <Image
              src="/images/catalog-hero-ai-renovation.webp"
              alt=""
              fill
              priority
              sizes="100vw"
              className="-z-20 object-cover object-center"
            />
            <div
              aria-hidden
              className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.92)_38%,rgba(255,255,255,0.52)_62%,rgba(255,255,255,0.10)_100%)]"
            />

            <Container className="space-y-6 py-8 sm:py-12 lg:py-16">
              <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Catalogue" }]} />

              <header className="space-y-4">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                  Catalogue des formations
                </h1>
                <CourseSearchBar integrated />
              </header>
            </Container>
          </section>

          <Container className="space-y-6 py-8">
            {/* Layout 2 colonnes : sidebar filtres + grid résultats, dès lg+.
                En sm-md on garde la top bar de chips + mobile bottom bar. */}
            <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
              <CourseFilterSidebar
                categories={categoryOptions}
                counts={filterCounts}
                className="hidden lg:block"
              />

              <div className="min-w-0 space-y-6">
                <CourseFilterBar
                  categories={categoryOptions}
                  counts={filterCounts}
                  categoryOnly
                  className="hidden sm:flex lg:hidden"
                />

                {items.length === 0 ? (
                  <>
                    <CourseResultsArea
                      courses={items}
                      currency={currency}
                      total={total}
                      searchTerm={filters.q}
                    />
                    <CourseEmptyState
                      basePath="/cours"
                      suggestedCategories={categoryOptions.slice(0, 6)}
                    />
                  </>
                ) : (
                  <>
                    <CourseResultsArea
                      courses={items}
                      currency={currency}
                      total={total}
                      searchTerm={filters.q}
                    />
                    {!showAll && total > COURSES_PER_PAGE ? (
                      <div className="flex justify-center pt-2">
                        <Link
                          href={buildViewAllHref(params)}
                          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[color:var(--brand-secondary)] px-6 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-secondary)] focus-visible:ring-offset-2"
                        >
                          Voir toutes les formations →
                        </Link>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </Container>
        </main>

        <CourseMobileFilterBar
          categories={categoryOptions}
          counts={filterCounts}
          categoryOnly
        />
      </FilterTransitionProvider>

      <SiteFooter />
    </>
  );
}

function buildViewAllHref(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && value.length > 0) next.set(key, value);
    else if (Array.isArray(value) && value.length > 0) next.set(key, value[0]);
  }
  next.delete("page");
  next.set("view", "all");
  return `/cours?${next.toString()}`;
}
