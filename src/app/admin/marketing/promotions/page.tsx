import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  createBanner,
  deleteBanner,
  toggleBanner,
} from "@/server/actions/admin-marketing";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Bannières & promotions" };

export const dynamic = "force-dynamic";

export default async function BannersPage() {
  const banners = await prisma.sitewideBanner.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Bannières & promotions
        </h1>
        <p className="text-sm text-muted-foreground">
          Bannières sitewide programmables (soldes, événements, annonces).
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bannières existantes</CardTitle>
          </CardHeader>
          <CardContent>
            {banners.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune bannière.</p>
            ) : (
              <ul className="space-y-2">
                {banners.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{b.message}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <StatusBadge tone={b.kind === "PROMO" ? "success" : b.kind === "WARNING" ? "warning" : "info"}>
                          {b.kind}
                        </StatusBadge>
                        {b.isActive ? (
                          <StatusBadge tone="success">Active</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">Inactive</StatusBadge>
                        )}
                        {b.ctaUrl ? <span>{b.ctaLabel} → {b.ctaUrl}</span> : null}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <form
                        action={async () => {
                          "use server";
                          await toggleBanner(b.id, !b.isActive);
                        }}
                      >
                        <Button type="submit" size="sm" variant="outline">
                          {b.isActive ? "Désactiver" : "Activer"}
                        </Button>
                      </form>
                      <form
                        action={async () => {
                          "use server";
                          await deleteBanner(b.id);
                        }}
                      >
                        <Button type="submit" size="sm" variant="outline">
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
            <CardTitle className="text-base">Nouvelle bannière</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={async (formData: FormData) => {
                "use server";
                await createBanner(formData);
              }}
              className="space-y-3"
            >
              <FormField id="message" label="Message">
                <Input id="message" name="message" required maxLength={200} />
              </FormField>
              <FormField id="ctaLabel" label="Libellé CTA">
                <Input id="ctaLabel" name="ctaLabel" maxLength={40} />
              </FormField>
              <FormField id="ctaUrl" label="Lien CTA">
                <Input id="ctaUrl" name="ctaUrl" type="url" />
              </FormField>
              <FormField id="kind" label="Type">
                <Select id="kind" name="kind" defaultValue="INFO">
                  <option value="INFO">Information</option>
                  <option value="PROMO">Promo</option>
                  <option value="WARNING">Avertissement</option>
                </Select>
              </FormField>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isActive" defaultChecked />
                Active
              </label>
              <Button type="submit" size="sm" className="w-full">
                Créer
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
