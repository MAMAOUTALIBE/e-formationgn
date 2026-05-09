import { Container } from "@/components/ui/container";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// État de chargement de /apprentissage. Affiché instantanément pendant que
// les requêtes Prisma (enrollments + recos) tournent en RSC.

export default function LearningLoading() {
  return (
    <main className="flex-1 bg-muted/20 py-8">
      <Container className="space-y-6">
        <Skeleton className="h-4 w-48" />
        <div>
          <Skeleton className="mb-2 h-8 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-video w-full rounded-none" />
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </main>
  );
}
