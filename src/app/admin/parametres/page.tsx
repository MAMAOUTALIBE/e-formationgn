import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Paramètres" };

const TILES: Array<{ href: string; label: string; description: string }> = [
  {
    href: "/admin/categories",
    label: "Catégories",
    description: "Hiérarchie, ordre d'affichage, activation.",
  },
  {
    href: "/admin/cms",
    label: "Pages CMS",
    description: "CGV, mentions légales, RGPD, FAQ, etc.",
  },
  {
    href: "/admin/parametres/emails",
    label: "Templates emails",
    description: "Emails transactionnels.",
  },
  {
    href: "/admin/parametres/branding",
    label: "Branding",
    description: "Logo, couleurs, favicon.",
  },
];

export default function AdminSettingsHubPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Paramètres
        </h1>
        <p className="text-sm text-muted-foreground">
          Configuration globale de la plateforme.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modules</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {TILES.map((t) => (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className="block rounded-md border border-border p-3 hover:bg-muted/50"
                >
                  <p className="font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
