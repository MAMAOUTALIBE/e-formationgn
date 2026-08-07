import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/branding/logo";
import { AdminThemeForm } from "@/components/features/admin/admin-theme-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminUiTheme } from "@/server/queries/admin-theme";

export const metadata: Metadata = { title: "Branding" };

export default async function BrandingSettingsPage() {
  const theme = await getAdminUiTheme();

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
          <CardTitle className="text-base">Apparence du CRM</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-5 text-sm text-muted-foreground">
            Taille du texte, et fond de la barre latérale, de l&apos;en-tête et
            du pied de page du back-office. Ces réglages ne s&apos;appliquent
            qu&apos;au CRM — le site public reste inchangé.
          </p>
          <AdminThemeForm
            current={theme.colors}
            currentTextScale={theme.textScale}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wordmark Gandal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Le logo est un wordmark texte (style Udemy) défini dans{" "}
            <code>src/components/branding/logo.tsx</code>. Pour modifier la
            graisse, l&apos;italique ou le point coloré, éditer ce fichier.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-border bg-card p-6 text-center">
              <Logo width={160} />
              <p className="mt-3 text-xs text-muted-foreground">default</p>
            </div>
            <div className="rounded-md border border-border bg-[color:var(--brand-primary)] p-6 text-center">
              <Logo width={160} variant="light" />
              <p className="mt-3 text-xs text-white/70">light (fond sombre)</p>
            </div>
            <div className="rounded-md border border-border bg-card p-6 text-center">
              <Logo width={160} variant="mark" />
              <p className="mt-3 text-xs text-muted-foreground">
                mark (favicon / mobile étroit)
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Le favicon SVG (<code>/public/logo-mark.svg</code>) est utilisé
            par le manifest PWA pour l&apos;icône d&apos;app installée.
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
