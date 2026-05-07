import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { CourseFilters } from "@/components/features/courses/course-filters";
import { CourseGrid } from "@/components/features/courses/course-grid";
import { CoursePagination } from "@/components/features/courses/course-pagination";
import { CourseSearchBar } from "@/components/features/courses/course-search-bar";
import { CourseSort } from "@/components/features/courses/course-sort";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { getCategoryBySlug, listCategories } from "@/server/queries/categories";
import { listPublishedCourses } from "@/server/queries/courses";
import { COURSES_PER_PAGE, courseFiltersSchema } from "@/lib/validators/courses";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Catégorie introuvable" };
  return {
    title: category.name,
    description:
      category.description ??
      `Tous les cours de la catégorie ${category.name} sur E-FormationGN.`,
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

  const [{ items, total, page, pageCount }, allCategories] = await Promise.all([
    listPublishedCourses({
      filters,
      take: COURSES_PER_PAGE,
      skip: (filters.page - 1) * COURSES_PER_PAGE,
    }),
    listCategories(),
  ]);

  const flatParams: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(sp)) {
    if (key === "page" || key === "category") continue;
    flatParams[key] = value;
  }

  return (
    <>
      <SiteHeader />

      <main className="flex-1 bg-muted/20 py-8">
        <Container className="space-y-6">
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
              {total.toLocaleString("fr-FR")} {total > 1 ? "cours disponibles" : "cours disponible"}
            </p>
          </header>

          <CourseSearchBar />

          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            <CourseFilters
              categories={allCategories.map((c) => ({ slug: c.slug, name: c.name }))}
              hideCategory
            />

            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} sur {pageCount}
                </p>
                <CourseSort />
              </div>

              <CourseGrid courses={items} currency={currency} />

              <CoursePagination
                currentPage={page}
                pageCount={pageCount}
                searchParams={flatParams}
                basePath={`/categories/${slug}`}
              />
            </div>
          </div>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
