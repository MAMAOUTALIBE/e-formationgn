import type { Metadata } from "next";

import { auth } from "@/auth";
import { CourseEmptyState } from "@/components/features/courses/course-empty-state";
import { CourseFilterBar } from "@/components/features/courses/course-filter-bar";
import { CourseFilterSidebar } from "@/components/features/courses/course-filter-sidebar";
import { CourseResultsArea } from "@/components/features/courses/course-results-area";
import { CourseSaleBanner } from "@/components/features/courses/course-sale-banner";
import { FilterTransitionProvider } from "@/components/features/courses/filter-transition-context";
import { CourseMobileFilterBar } from "@/components/features/courses/course-mobile-filter-bar";
import { CoursePagination } from "@/components/features/courses/course-pagination";
import { CourseSearchBar } from "@/components/features/courses/course-search-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { listCategories } from "@/server/queries/categories";
import { getCourseFilterCounts, listPublishedCourses } from "@/server/queries/courses";
import { getActiveSale } from "@/server/queries/sale";
import { COURSES_PER_PAGE, courseFiltersSchema } from "@/lib/validators/courses";

export const metadata: Metadata = {
  title: "Catalogue des cours",
  description:
    "Parcourez tout le catalogue de formations Gandal : développement, design, business, langues, et bien plus.",
  alternates: { canonical: "/cours" },
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CoursesCatalogPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = courseFiltersSchema.parse(params);
  const session = await auth();
  const currency = session?.user.preferredCurrency ?? "EUR";

  const [{ items, total, page, pageCount }, categories, filterCounts, activeSale] =
    await Promise.all([
      listPublishedCourses({
        filters,
        take: COURSES_PER_PAGE,
        skip: (filters.page - 1) * COURSES_PER_PAGE,
      }),
      listCategories(),
      getCourseFilterCounts(filters),
      getActiveSale(),
    ]);

  const categoryOptions = categories.map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <>
      <SiteHeader />

      {/* Un seul FilterTransitionProvider wrappe main + mobile bottom bar :
          le pending state se propage à tous les filtres (sidebar desktop,
          top bar tablette, drawer + tri mobile) et à la zone résultats. */}
      <FilterTransitionProvider>
        <main className="flex-1 bg-muted/20 py-8">
          <Container className="space-y-6">
            <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Catalogue" }]} />

            <header className="space-y-4">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Catalogue des cours
              </h1>
              <CourseSearchBar />
            </header>

            {activeSale ? (
              <CourseSaleBanner
                endsAt={activeSale.endsAt.toISOString()}
                coursesCount={activeSale.coursesCount}
              />
            ) : null}

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
                    <CoursePagination
                      currentPage={page}
                      pageCount={pageCount}
                      searchParams={params}
                      basePath="/cours"
                    />
                  </>
                )}
              </div>
            </div>
          </Container>
        </main>

        <CourseMobileFilterBar categories={categoryOptions} counts={filterCounts} />
      </FilterTransitionProvider>

      <SiteFooter />
    </>
  );
}
