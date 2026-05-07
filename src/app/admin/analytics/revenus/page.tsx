import type { Metadata } from "next";

import { CategoryDonut } from "@/components/features/admin/charts/category-donut";
import { RevenueChart } from "@/components/features/admin/charts/revenue-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { parsePeriodParam, periodToRange } from "@/lib/admin/period";
import {
  getRevenueByCategory,
  getRevenueTimeseries,
} from "@/server/queries/admin-overview";

export const metadata: Metadata = { title: "Revenus détaillés" };

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function RevenueDetailsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const range = periodToRange(parsePeriodParam(params.period ?? null));
  const [series, byCategory] = await Promise.all([
    getRevenueTimeseries(range),
    getRevenueByCategory(range),
  ]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Revenus détaillés
          </h1>
          <p className="text-sm text-muted-foreground">
            Évolution sur la période et répartition par catégorie.
          </p>
        </div>
        <DateRangePicker />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Évolution</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueChart data={series} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Par catégorie</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryDonut data={byCategory} />
        </CardContent>
      </Card>
    </div>
  );
}
