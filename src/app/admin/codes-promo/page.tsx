import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { prisma } from "@/lib/prisma";
import { deletePromoCode, upsertPromoCode } from "@/server/actions/admin";

export const metadata: Metadata = {
  title: "Codes promo",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function AdminPromoCodesPage() {
  const promos = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      instructor: {
        select: { id: true, name: true, firstName: true, email: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Codes promotionnels
        </h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Codes existants</CardTitle>
          </CardHeader>
          <CardContent>
            {promos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun code pour le moment.</p>
            ) : (
              <ul className="space-y-2">
                {promos.map((promo) => (
                  <li
                    key={promo.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">
                        <code>{promo.code}</code>{" "}
                        {!promo.isActive ? (
                          <Badge variant="outline">Inactif</Badge>
                        ) : null}{" "}
                        {promo.instructor ? (
                          <Badge variant="secondary">Formateur</Badge>
                        ) : (
                          <Badge variant="secondary">Plateforme</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {promo.kind === "PERCENTAGE"
                          ? `-${promo.value / 100} %`
                          : `-${(promo.value / 100).toFixed(2)} ${promo.currency}`}
                        {" · "}
                        {promo.scope} · {promo.usedCount} utilisations
                        {promo.endsAt
                          ? ` · expire ${dateFormatter.format(promo.endsAt)}`
                          : ""}
                      </p>
                      {promo.instructor ? (
                        <p className="text-xs text-muted-foreground">
                          Créé par :{" "}
                          {promo.instructor.name ??
                            promo.instructor.firstName ??
                            promo.instructor.email}
                        </p>
                      ) : null}
                    </div>
                    <form
                      action={async () => {
                        "use server";
                        await deletePromoCode(promo.id);
                      }}
                    >
                      <Button type="submit" variant="outline" size="sm">
                        Supprimer
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouveau code</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={async (formData: FormData) => {
                "use server";
                await upsertPromoCode(formData);
              }}
              className="space-y-4"
            >
              <FormField id="code" label="Code" required hint="Majuscules / chiffres / tirets">
                <Input id="code" name="code" required maxLength={40} pattern="[A-Z0-9_-]+" />
              </FormField>
              <FormField id="kind" label="Type">
                <Select id="kind" name="kind" defaultValue="PERCENTAGE">
                  <option value="PERCENTAGE">Pourcentage (en bps)</option>
                  <option value="FIXED_AMOUNT">Montant fixe (en cents)</option>
                </Select>
              </FormField>
              <FormField id="value" label="Valeur" required>
                <Input id="value" name="value" type="number" min={1} required />
              </FormField>
              <FormField id="currency" label="Devise (montant fixe)">
                <Select id="currency" name="currency" defaultValue="EUR">
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </Select>
              </FormField>
              <FormField id="scope" label="Portée">
                <Select id="scope" name="scope" defaultValue="GLOBAL">
                  <option value="GLOBAL">Toutes les formations</option>
                  <option value="COURSE_SPECIFIC">Formations spécifiques</option>
                </Select>
              </FormField>
              <FormField id="maxRedemptions" label="Limite d'utilisations" hint="Optionnel">
                <Input id="maxRedemptions" name="maxRedemptions" type="number" min={1} />
              </FormField>
              <FormField id="endsAt" label="Fin">
                <Input id="endsAt" name="endsAt" type="datetime-local" />
              </FormField>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isActive" defaultChecked /> Actif
              </label>
              <Button type="submit" className="w-full">
                Créer le code
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
