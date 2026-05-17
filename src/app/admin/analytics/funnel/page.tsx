import type { Metadata } from "next";
import { Filter, ShoppingCart, Trophy, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { periodToRange } from "@/lib/admin/period";
import { readPeriod } from "@/lib/admin/period-server";
import { cn } from "@/lib/utils";
import { getConversionFunnel } from "@/server/queries/admin-analytics";

export const metadata: Metadata = { title: "Funnel de conversion — Admin" };

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

const FUNNEL_COLORS = [
  "bg-[color:var(--brand-primary)]",
  "bg-[color:var(--brand-secondary)]",
  "bg-[color:var(--brand-warning)]",
  "bg-[color:var(--brand-success)]",
] as const;

export default async function ConversionFunnelPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const range = periodToRange(await readPeriod(params.period ?? null));
  const funnel = await getConversionFunnel(range);

  const steps = [
    {
      key: "pageViews",
      label: "Vues de pages",
      value: funnel.totalPageViews,
      icon: <Users className="h-5 w-5" aria-hidden />,
      hint: "Trafic total sur la période",
    },
    {
      key: "sessions",
      label: "Sessions uniques",
      value: funnel.uniqueSessions,
      icon: <Filter className="h-5 w-5" aria-hidden />,
      hint: "Visiteurs distincts",
    },
    {
      key: "cart",
      label: "Cours ajoutés au panier",
      value: funnel.cartItemsCreated,
      icon: <ShoppingCart className="h-5 w-5" aria-hidden />,
      hint: "Intention d'achat",
    },
    {
      key: "paid",
      label: "Commandes payées",
      value: funnel.ordersPaid,
      icon: <Trophy className="h-5 w-5" aria-hidden />,
      hint: "Conversion finale",
    },
  ];

  const maxValue = Math.max(...steps.map((s) => s.value), 1);

  // Drop rates entre chaque étape
  const drops = steps.slice(1).map((step, idx) => {
    const previous = steps[idx].value;
    if (previous === 0)
      return { key: step.key, lostPercent: 0, lostCount: 0, conversionPercent: 0 };
    const lostCount = previous - step.value;
    const lostPercent = (lostCount / previous) * 100;
    const conversionPercent = (step.value / previous) * 100;
    return {
      key: step.key,
      lostPercent: Math.max(0, lostPercent),
      lostCount: Math.max(0, lostCount),
      conversionPercent,
    };
  });

  const overallConversion =
    funnel.uniqueSessions > 0
      ? (funnel.ordersPaid / funnel.uniqueSessions) * 100
      : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Funnel de conversion
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suivi étape par étape du parcours visiteur → client.
          </p>
        </div>
        <DateRangePicker />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Taux de conversion global :{" "}
            <span className="text-[color:var(--brand-secondary)]">
              {overallConversion.toFixed(2)} %
            </span>
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Sessions uniques → commandes payées sur la période sélectionnée.
          </p>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {steps.map((step, idx) => {
              const widthPercent = (step.value / maxValue) * 100;
              const drop = idx > 0 ? drops[idx - 1] : null;
              return (
                <li key={step.key}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      {step.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-foreground">
                          {step.label}
                        </span>
                        <span className="tabular-nums font-semibold text-foreground">
                          {step.value.toLocaleString("fr-FR")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{step.hint}</p>
                      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full transition-all",
                            FUNNEL_COLORS[idx % FUNNEL_COLORS.length],
                          )}
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  {drop && drop.lostCount > 0 ? (
                    <p className="ml-13 mt-1 pl-13 text-xs text-muted-foreground">
                      <span className="pl-[3.25rem]">
                        ↓{" "}
                        <strong className="text-[color:var(--brand-danger)]">
                          {drop.lostCount.toLocaleString("fr-FR")} perdus
                        </strong>{" "}
                        ({drop.lostPercent.toFixed(1)}%) entre cette étape et la
                        précédente — taux de passage{" "}
                        <strong className="text-foreground">
                          {drop.conversionPercent.toFixed(1)}%
                        </strong>
                      </span>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lecture du funnel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Drop visites → sessions :</strong>{" "}
            normal si plusieurs pages vues par session.
          </p>
          <p>
            <strong className="text-foreground">Drop sessions → panier :</strong>{" "}
            mesure l&apos;intérêt. Bas = catalogue peu attractif ou prix mal perçu.
          </p>
          <p>
            <strong className="text-foreground">Drop panier → paiement :</strong>{" "}
            mesure la friction checkout. Bas = problème de paiement (méthode,
            confiance, perception prix final).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
