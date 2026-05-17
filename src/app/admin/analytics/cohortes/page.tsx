import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCohorts } from "@/server/queries/admin-analytics";

export const metadata: Metadata = { title: "Cohortes" };

export const dynamic = "force-dynamic";

// Échelle de couleurs pour la heatmap — du muted (faible) au success (fort).
// Inspiré GitHub contribution graph mais avec la couleur brand secondary.
function heatColor(percent: number): string {
  if (percent === 0) return "bg-muted text-muted-foreground";
  if (percent < 10) return "bg-[color:var(--brand-secondary)]/10 text-foreground";
  if (percent < 25) return "bg-[color:var(--brand-secondary)]/25 text-foreground";
  if (percent < 50) return "bg-[color:var(--brand-secondary)]/45 text-white";
  if (percent < 75) return "bg-[color:var(--brand-secondary)]/70 text-white";
  return "bg-[color:var(--brand-secondary)] text-white";
}

export default async function CohortsPage() {
  const cohorts = await getCohorts();

  // Moyennes pour la ligne récap en bas
  const totalSignups = cohorts.reduce((s, c) => s + c.signups, 0);
  const totalRet30 = cohorts.reduce((s, c) => s + c.retainedDay30, 0);
  const totalRet60 = cohorts.reduce((s, c) => s + c.retainedDay60, 0);
  const totalRet90 = cohorts.reduce((s, c) => s + c.retainedDay90, 0);
  const avg30 = totalSignups > 0 ? (totalRet30 / totalSignups) * 100 : 0;
  const avg60 = totalSignups > 0 ? (totalRet60 / totalSignups) * 100 : 0;
  const avg90 = totalSignups > 0 ? (totalRet90 / totalSignups) * 100 : 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Cohortes — Rétention
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          % d&apos;élèves d&apos;une cohorte mensuelle qui consomment encore du
          contenu après 30 / 60 / 90 jours. Heatmap — plus c&apos;est foncé, plus
          c&apos;est bon.
        </p>
      </header>

      {/* Bandeau moyennes globales */}
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Moyenne J+30" percent={avg30} />
        <SummaryTile label="Moyenne J+60" percent={avg60} />
        <SummaryTile label="Moyenne J+90" percent={avg90} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Heatmap des 6 derniers mois</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {cohorts.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Pas assez de données pour afficher des cohortes.
            </p>
          ) : (
            <table className="w-full min-w-[560px] border-separate border-spacing-1 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Cohorte</th>
                  <th className="px-2 py-2 text-right font-medium">Inscrits</th>
                  <th className="px-2 py-2 text-center font-medium">J+30</th>
                  <th className="px-2 py-2 text-center font-medium">J+60</th>
                  <th className="px-2 py-2 text-center font-medium">J+90</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => {
                  const p30 = c.signups > 0 ? (c.retainedDay30 / c.signups) * 100 : 0;
                  const p60 = c.signups > 0 ? (c.retainedDay60 / c.signups) * 100 : 0;
                  const p90 = c.signups > 0 ? (c.retainedDay90 / c.signups) * 100 : 0;
                  return (
                    <tr key={c.cohortMonth}>
                      <td className="px-2 py-2 font-medium text-foreground">
                        {formatCohortMonth(c.cohortMonth)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                        {c.signups.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <HeatCell count={c.retainedDay30} percent={p30} />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <HeatCell count={c.retainedDay60} percent={p60} />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <HeatCell count={c.retainedDay90} percent={p90} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Légende */}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
            <span>Échelle :</span>
            {[0, 10, 25, 50, 75, 100].map((threshold) => (
              <span
                key={threshold}
                className={`inline-flex h-5 w-10 items-center justify-center rounded text-[10px] font-semibold ${heatColor(threshold)}`}
              >
                {threshold}%
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({ label, percent }: { label: string; percent: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 inline-block rounded px-2 py-1 text-2xl font-semibold tabular-nums ${heatColor(percent)}`}
      >
        {percent.toFixed(1)}%
      </p>
    </div>
  );
}

function HeatCell({ count, percent }: { count: number; percent: number }) {
  return (
    <div
      className={`inline-flex min-w-[60px] flex-col items-center rounded px-2 py-1.5 ${heatColor(percent)}`}
      title={`${percent.toFixed(1)}% — ${count} élève${count > 1 ? "s" : ""}`}
    >
      <span className="text-sm font-semibold tabular-nums">
        {percent.toFixed(0)}%
      </span>
      <span className="text-[10px] opacity-75">
        {count.toLocaleString("fr-FR")}
      </span>
    </div>
  );
}

function formatCohortMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" })
    .format(date);
}
