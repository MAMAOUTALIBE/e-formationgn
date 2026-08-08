import type { Metadata } from "next";

import { CategoryCard } from "@/components/features/courses/category-card";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { listCategories } from "@/server/queries/categories";

export const metadata: Metadata = {
  title: "Catégories",
  description: "Toutes les catégories de cours sur Gandal.",
  alternates: { canonical: "/categories" },
};

// Les catégories peuvent évoluer (admin, nouveaux cours) — on rend la page
// dynamique pour avoir toujours des données à jour. À ajuster si besoin
// (ISR / revalidate) en Phase 8 quand on optimisera les performances.
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await listCategories();

  return (
    <>
      <SiteHeader />

      <main className="flex-1 bg-muted/20 py-8">
        <Container className="space-y-6">
          <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Catégories" }]} />

          <header>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Catégories
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Explorez les domaines couverts par notre catalogue.
            </p>
          </header>

          {categories.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-10 text-center text-sm text-muted-foreground">
              Les catégories seront bientôt disponibles.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          )}
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
