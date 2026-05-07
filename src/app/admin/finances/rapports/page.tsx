import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportButton } from "@/components/ui/export-button";
import { exportFinancialReport } from "@/server/actions/admin-reports";

export const metadata: Metadata = { title: "Rapports financiers" };

export default function AdminFinancialReportsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Rapports financiers
        </h1>
        <p className="text-sm text-muted-foreground">
          Exports CSV mensuels avec ventilation TVA / commissions / payouts.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export du mois en cours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Toutes les commandes payées du mois en cours, ventilées par
            ligne de commande, formateur et catégorie.
          </p>
          <ExportButton action={exportFinancialReport} label="Exporter le rapport" />
        </CardContent>
      </Card>
    </div>
  );
}
