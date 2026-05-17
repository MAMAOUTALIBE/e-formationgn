import type { Metadata } from "next";

import { auth } from "@/auth";
import { CourseEmptyState } from "@/components/features/courses/course-empty-state";
import { CourseFilterBar } from "@/components/features/courses/course-filter-bar";
import { CourseGrid } from "@/components/features/courses/course-grid";
import { CourseMobileFilterBar } from "@/components/features/courses/course-mobile-filter-bar";
import { CoursePagination } from "@/components/features/courses/course-pagination";
import { CourseSearchBar } from "@/components/features/courses/course-search-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { listCategories } from "@/server/queries/categories";
import { listPublishedCourses } from "@/server/queries/courses";
import { COURSES_PER_PAGE, courseFiltersSchema } from "@/lib/validators/courses";

export const metadata: Metadata = {
  title: "Catalogue des cours",
  description:
    "Parcourez tout le catalogue de formations Gandal : développement, design, business, langues, et bien plus.",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CoursesCatalogPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = courseFiltersSchema.parse(params);
  const session = await auth();
  const currency = session?.user.preferredCurrency ?? "EUR";

  const [{ items, total, page, pageCount }, categories] = await Promise.all([
    listPublishedCourses({
      filters,
      take: COURSES_PER_PAGE,
      skip: (filters.page - 1) * COURSES_PER_PAGE,
    }),
    listCategories(),
  ]);

  const categoryOptions = categories.map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <>
      <SiteHeader />

      <main className="flex-1 bg-muted/20 py-8">
        <Container className="space-y-6">
          <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Catalogue" }]} />

          <header className="space-y-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Catalogue des cours
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {total.toLocaleString("fr-FR")} {total > 1 ? "cours disponibles" : "cours disponible"}
                {filters.q ? ` pour « ${filters.q} »` : ""}.
              </p>
            </div>
            <CourseSearchBar />
          </header>

          <CourseFilterBar
            categories={categoryOptions}
            className="hidden sm:flex"
          />

          {items.length === 0 ? (
            <CourseEmptyState basePath="/cours" />
          ) : (
            <>
              <CourseGrid courses={items} currency={currency} />
              <CoursePagination
                currentPage={page}
                pageCount={pageCount}
                searchParams={params}
                basePath="/cours"
              />
            </>
          )}
        </Container>
      </main>

      <CourseMobileFilterBar categories={categoryOptions} />

      <SiteFooter />
    </>
  );
}
