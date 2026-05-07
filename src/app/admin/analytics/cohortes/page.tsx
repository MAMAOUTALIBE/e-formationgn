import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCohorts } from "@/server/queries/admin-analytics";

export const metadata: Metadata = { title: "Cohortes" };

export const dynamic = "force-dynamic";

export default async function CohortsPage() {
  const cohorts = await getCohorts();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Cohortes
        </h1>
        <p className="text-sm text-muted-foreground">
          Rétention par mois d&apos;inscription : combien d&apos;élèves ont
          consommé du contenu après 30 / 60 / 90 jours.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">6 derniers mois</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Cohorte</th>
                <th className="px-4 py-3 text-right">Inscrits</th>
                <th className="px-4 py-3 text-right">J+30</th>
                <th className="px-4 py-3 text-right">J+60</th>
                <th className="px-4 py-3 text-right">J+90</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cohorts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Pas assez de données.
                  </td>
                </tr>
              ) : (
                cohorts.map((c) => (
                  <tr key={c.cohortMonth}>
                    <td className="px-4 py-3 font-medium">{c.cohortMonth}</td>
                    <td className="px-4 py-3 text-right">{c.signups}</td>
                    <td className="px-4 py-3 text-right">
                      {c.retainedDay30}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({pct(c.retainedDay30, c.signups)})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.retainedDay60}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({pct(c.retainedDay60, c.signups)})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.retainedDay90}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({pct(c.retainedDay90, c.signups)})
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function pct(part: number, total: number): string {
  if (total === 0) return "—";
  return `${((part / total) * 100).toFixed(0)} %`;
}
