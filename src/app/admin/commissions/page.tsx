import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/prisma";
import { updateCommissionRate } from "@/server/actions/admin";

export const metadata: Metadata = {
  title: "Commissions",
};

export const dynamic = "force-dynamic";

const SOURCES: Array<{ key: "INSTRUCTOR_DRIVEN" | "PLATFORM_DRIVEN"; label: string; defaultBps: number }> = [
  {
    key: "INSTRUCTOR_DRIVEN",
    label: "Vente initiée par le formateur (lien d'affiliation)",
    defaultBps: 1500,
  },
  {
    key: "PLATFORM_DRIVEN",
    label: "Vente initiée par la plateforme",
    defaultBps: 3000,
  },
];

export default async function AdminCommissionsPage() {
  const rates = await prisma.commissionRate.findMany();
  const byKey = new Map(rates.map((r) => [r.source, r]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Taux de commission
        </h1>
        <p className="text-sm text-muted-foreground">
          Les taux sont stockés en points de base : 1500 = 15&nbsp;%, 3000 = 30&nbsp;%.
          Ils s&apos;appliquent à toute nouvelle commande (les commandes existantes
          gardent les taux snapshottés au moment de l&apos;achat).
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {SOURCES.map((source) => {
          const current = byKey.get(source.key);
          return (
            <Card key={source.key}>
              <CardHeader>
                <CardTitle className="text-base">{source.label}</CardTitle>
                <CardDescription>
                  Taux actuel : {(current?.rateBps ?? source.defaultBps) / 100}&nbsp;%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    await updateCommissionRate(formData);
                  }}
                  className="space-y-3"
                >
                  <input type="hidden" name="source" value={source.key} />
                  <FormField id={`rate-${source.key}`} label="Taux (bps)" required>
                    <Input
                      id={`rate-${source.key}`}
                      name="rateBps"
                      type="number"
                      min={0}
                      max={10000}
                      defaultValue={current?.rateBps ?? source.defaultBps}
                      required
                    />
                  </FormField>
                  <FormField id={`desc-${source.key}`} label="Description">
                    <Textarea
                      id={`desc-${source.key}`}
                      name="description"
                      rows={2}
                      defaultValue={current?.description ?? ""}
                      maxLength={500}
                    />
                  </FormField>
                  <Button type="submit">Enregistrer</Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
