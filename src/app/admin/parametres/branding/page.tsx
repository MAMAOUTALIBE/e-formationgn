import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Branding" };

export default function BrandingSettingsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Branding
        </h1>
        <p className="text-sm text-muted-foreground">
          Logo, couleurs et favicon. Définis dans <code>BRAND.md</code> et{" "}
          <code>src/app/globals.css</code>.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">Trois variantes disponibles dans <code>/public</code> :</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-3">
            <li className="rounded-md border border-border p-3 text-center text-sm">
              logo.svg
            </li>
            <li className="rounded-md border border-border p-3 text-center text-sm">
              logo-white.svg
            </li>
            <li className="rounded-md border border-border p-3 text-center text-sm">
              logo-mark.svg
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Pour modifier : remplacer les fichiers SVG dans le dossier{" "}
            <code>/public</code> et redéployer.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Palette de couleurs</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <PaletteItem name="brand-primary" hex="#1E3A8A" />
            <PaletteItem name="brand-secondary" hex="#0EA5E9" />
            <PaletteItem name="brand-violet" hex="#7C3AED" />
            <PaletteItem name="brand-violet-deep" hex="#5B21B6" />
            <PaletteItem name="brand-mint" hex="#92F6A1" />
            <PaletteItem name="brand-mint-deep" hex="#6CE382" />
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Définies via CSS variables dans <code>globals.css</code>. Voir{" "}
            <Link href="/admin/parametres" className="hover:underline">
              Paramètres
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PaletteItem({ name, hex }: { name: string; hex: string }) {
  return (
    <li className="flex items-center gap-3 rounded-md border border-border p-2">
      <span
        className="inline-block h-8 w-8 rounded ring-1 ring-border"
        style={{ background: hex }}
        aria-hidden
      />
      <div>
        <p className="font-mono text-xs">--{name}</p>
        <p className="text-xs text-muted-foreground">{hex}</p>
      </div>
    </li>
  );
}
