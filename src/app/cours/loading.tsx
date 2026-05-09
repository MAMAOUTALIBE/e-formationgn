import { Container } from "@/components/ui/container";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// État de chargement de /cours. Le catalogue déclenche plusieurs queries
// (filters, count, items, categories) — un skeleton évite le flash d'écran vide.

export default function CatalogLoading() {
  return (
    <main className="flex-1 bg-muted/20 py-8">
      <Container className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-72" />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          {/* Filtres */}
          <aside className="hidden space-y-4 lg:block">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </aside>

          {/* Grille cours */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-video w-full rounded-none" />
                <CardContent className="space-y-3 p-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Container>
    </main>
  );
}
