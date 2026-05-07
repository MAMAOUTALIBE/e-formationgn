import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Paramètres commerce" };

export default function CommerceSettingsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Commerce
        </h1>
        <p className="text-sm text-muted-foreground">
          Devises actives, taxes par pays, méthodes de paiement.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Devises actives</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            <li>EUR (€) — défaut plateforme</li>
            <li>USD ($) — actif pour la clientèle internationale</li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Pour ajouter une devise : ajouter une valeur à l&apos;enum{" "}
            <code>Currency</code> du schéma Prisma puis migrer.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Méthodes de paiement</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            <strong>Stripe Checkout</strong> — encaissement, puis transferts
            Stripe Connect vers les formateurs (Express).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
