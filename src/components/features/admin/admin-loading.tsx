// Skeletons réutilisables pour les pages admin pendant le chargement.

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminPageHeaderSkeleton() {
  return (
    <header className="space-y-2">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-4 w-96" />
    </header>
  );
}

export function AdminKpiGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="mb-3 h-3 w-20" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-2 h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function AdminChartSkeleton({ heightClass = "h-72" }: { heightClass?: string }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className={heightClass} />
      </CardContent>
    </Card>
  );
}

export function AdminTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Card>
      <CardContent className="overflow-hidden p-0">
        <div className="border-b border-border bg-muted/40 px-4 py-3">
          <Skeleton className="h-4 w-40" />
        </div>
        <ul className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-20" />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function AdminPageSkeleton({
  kpis = 4,
  withChart = false,
}: {
  kpis?: number;
  withChart?: boolean;
}) {
  return (
    <div className="space-y-6">
      <AdminPageHeaderSkeleton />
      <AdminKpiGridSkeleton count={kpis} />
      {withChart ? <AdminChartSkeleton /> : null}
      <AdminTableSkeleton />
    </div>
  );
}
