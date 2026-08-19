import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatPriceFromCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  createInstructorPromoCode,
  deleteInstructorPromoCode,
  toggleInstructorPromoCode,
} from "@/server/actions/instructor-promo";

export const metadata: Metadata = {
  title: "Codes promo",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function InstructorPromoCodesPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/formateur/codes-promo");
  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    redirect("/devenir-formateur");
  }

  const [promos, courses, salesByPromo] = await Promise.all([
    prisma.promoCode.findMany({
      where: { instructorId: session.user.id },
      include: {
        courses: {
          select: { course: { select: { id: true, title: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.course.findMany({
      where: { instructorId: session.user.id },
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
    // Performance réelle : commandes PAYÉES par code promo du formateur.
    // Agrégation côté base (groupBy) plutôt que de charger les commandes.
    prisma.order.groupBy({
      by: ["promoCodeId"],
      where: {
        status: "PAID",
        promoCode: { instructorId: session.user.id },
      },
      _count: true,
      _sum: { totalCents: true, discountCents: true },
    }),
  ]);

  // Index des ventes par code pour un accès O(1) dans le rendu.
  const salesById = new Map(
    salesByPromo.map((s) => [
      s.promoCodeId,
      {
        orders: s._count,
        grossCents: s._sum.totalCents ?? 0,
        discountCents: s._sum.discountCents ?? 0,
      },
    ]),
  );
  const totalRedemptions = salesByPromo.reduce((acc, s) => acc + s._count, 0);
  const codesWithSales = salesByPromo.filter((s) => s._count > 0).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Codes promo
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Créez des codes de réduction applicables uniquement à vos formations. La
          remise est imputée à votre part de revenu — la commission de la
          plateforme reste calculée sur le prix avant remise.
        </p>
      </header>

      {promos.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile
                label="Utilisations totales"
                value={totalRedemptions.toLocaleString("fr-FR")}
              />
              <StatTile
                label="Codes avec ventes"
                value={`${codesWithSales} / ${promos.length}`}
              />
              <StatTile
                label="Codes créés"
                value={promos.length.toLocaleString("fr-FR")}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Code</th>
                    <th className="py-2 pr-4 font-medium">Utilisations</th>
                    <th className="py-2 pr-4 font-medium">CA généré</th>
                    <th className="py-2 font-medium">Remise accordée</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((promo) => {
                    const sales = salesById.get(promo.id);
                    const orders = sales?.orders ?? 0;
                    const cur = promo.currency ?? "EUR";
                    return (
                      <tr key={promo.id} className="border-b border-border/60">
                        <td className="py-2 pr-4 font-mono text-foreground">
                          {promo.code}
                        </td>
                        <td className="py-2 pr-4 tabular-nums text-foreground">
                          {orders.toLocaleString("fr-FR")}
                          {promo.maxRedemptions != null ? (
                            <span className="text-muted-foreground">
                              {" "}
                              / {promo.maxRedemptions.toLocaleString("fr-FR")}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-4 tabular-nums text-foreground">
                          {orders > 0
                            ? formatPriceFromCents(sales?.grossCents ?? 0, cur)
                            : "—"}
                        </td>
                        <td className="py-2 tabular-nums text-muted-foreground">
                          {orders > 0
                            ? formatPriceFromCents(sales?.discountCents ?? 0, cur)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Les utilisations comptent les commandes payées ayant appliqué le
              code. Montants affichés dans la devise déclarée du code.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mes codes</CardTitle>
          </CardHeader>
          <CardContent>
            {promos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun code pour le moment. Créez-en un avec le formulaire à droite.
              </p>
            ) : (
              <ul className="space-y-2">
                {promos.map((promo) => (
                  <li
                    key={promo.id}
                    className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">
                        <code className="rounded bg-muted px-1 py-0.5">
                          {promo.code}
                        </code>{" "}
                        {!promo.isActive ? (
                          <Badge variant="outline">Inactif</Badge>
                        ) : null}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {promo.kind === "PERCENTAGE"
                          ? `-${promo.value / 100} %`
                          : `-${(promo.value / 100).toFixed(2)} ${promo.currency}`}
                        {" · "}
                        {promo.usedCount}
                        {promo.maxRedemptions
                          ? `/${promo.maxRedemptions}`
                          : ""}{" "}
                        utilisations
                        {promo.endsAt
                          ? ` · expire ${dateFormatter.format(promo.endsAt)}`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Formation :{" "}
                        {promo.courses
                          .map((c) => c.course.title)
                          .join(", ") || "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <form
                        action={async () => {
                          "use server";
                          await toggleInstructorPromoCode(promo.id, !promo.isActive);
                        }}
                      >
                        <Button type="submit" variant="outline" size="sm">
                          {promo.isActive ? "Désactiver" : "Activer"}
                        </Button>
                      </form>
                      <form
                        action={async () => {
                          "use server";
                          await deleteInstructorPromoCode(promo.id);
                        }}
                      >
                        <Button type="submit" variant="outline" size="sm">
                          Supprimer
                        </Button>
                      </form>
                    </div>
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
            {courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Vous devez d&apos;abord créer au moins une formation pour pouvoir
                générer un code promo.
              </p>
            ) : (
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await createInstructorPromoCode(formData);
                }}
                className="space-y-4"
              >
                <FormField
                  id="code"
                  label="Code"
                  required
                  hint="Majuscules, chiffres, tirets ou underscores"
                >
                  <Input
                    id="code"
                    name="code"
                    required
                    maxLength={40}
                    pattern="[A-Z0-9_-]+"
                    placeholder="EX: AWA20"
                  />
                </FormField>

                <FormField id="kind" label="Type">
                  <Select id="kind" name="kind" defaultValue="PERCENTAGE">
                    <option value="PERCENTAGE">Pourcentage (en bps)</option>
                    <option value="FIXED_AMOUNT">Montant fixe (en cents)</option>
                  </Select>
                </FormField>

                <FormField
                  id="value"
                  label="Valeur"
                  required
                  hint="2000 bps = 20 % · 1500 cents = 15,00"
                >
                  <Input id="value" name="value" type="number" min={1} required />
                </FormField>

                <FormField id="currency" label="Devise (montant fixe uniquement)">
                  <Select id="currency" name="currency" defaultValue="EUR">
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </Select>
                </FormField>

                <FormField
                  id="courseIds"
                  label="Formations concernées"
                  required
                  hint="Maintenez Ctrl/Cmd pour en sélectionner plusieurs"
                >
                  <select
                    id="courseIds"
                    name="courseIds"
                    multiple
                    required
                    size={Math.min(courses.length, 6)}
                    className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                        {c.status !== "PUBLISHED" ? ` (${c.status})` : ""}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  id="maxRedemptions"
                  label="Limite d'utilisations"
                  hint="Optionnel"
                >
                  <Input
                    id="maxRedemptions"
                    name="maxRedemptions"
                    type="number"
                    min={1}
                  />
                </FormField>

                <FormField id="endsAt" label="Date de fin" hint="Optionnel">
                  <Input id="endsAt" name="endsAt" type="datetime-local" />
                </FormField>

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isActive" defaultChecked />
                  Actif
                </label>

                <Button type="submit" className="w-full">
                  Créer le code
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
