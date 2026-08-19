import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Crédits et licences",
  description:
    "Attribution des contenus tiers utilisés en environnement de démonstration sur Aiduca.",
  robots: { index: false, follow: false },
};

export default function CreditsPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-background py-8">
        <Container className="space-y-6">
          <Breadcrumbs
            items={[{ label: "Accueil", href: "/" }, { label: "Crédits" }]}
          />

          <header className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Crédits et licences
            </h1>
            <p className="text-sm text-muted-foreground">
              Cette page liste les contenus tiers utilisés sur Aiduca
              dans un cadre de démonstration. Aucun de ces contenus n&apos;est
              vendu ; ils servent uniquement à animer la plateforme pendant la
              phase de tests.
            </p>
          </header>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              Vidéos sous licence Creative Commons
            </h2>
            <p className="text-sm text-muted-foreground">
              Les œuvres ci-dessous sont des « Open Movies » produits par la
              Blender Foundation et redistribués librement.
            </p>
            <ul className="space-y-2 text-sm text-foreground">
              <li>
                <strong>Big Buck Bunny</strong> © Blender Foundation —
                Licence{" "}
                <Link
                  href="https://creativecommons.org/licenses/by/3.0/"
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Creative Commons Attribution 3.0
                </Link>
                {" — "}
                <Link
                  href="https://peach.blender.org/"
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  peach.blender.org
                </Link>
              </li>
              <li>
                <strong>Sintel</strong> © Blender Foundation — Licence CC BY
                3.0 —{" "}
                <Link
                  href="https://durian.blender.org/"
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  durian.blender.org
                </Link>
              </li>
              <li>
                <strong>Tears of Steel</strong> © Blender Foundation — Licence
                CC BY 3.0 —{" "}
                <Link
                  href="https://mango.blender.org/"
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  mango.blender.org
                </Link>
              </li>
              <li>
                <strong>Elephant&apos;s Dream</strong> © Blender Foundation —
                Licence{" "}
                <Link
                  href="https://creativecommons.org/licenses/by/2.5/"
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Creative Commons Attribution 2.5
                </Link>
                {" — "}
                <Link
                  href="https://orange.blender.org/"
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  orange.blender.org
                </Link>
              </li>
              <li>
                <strong>For Bigger Blazes</strong> — Extrait technique fourni
                par Google Cloud Storage à des fins de test, libre d&apos;usage.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              Photos et vidéos d&apos;illustration
            </h2>
            <p className="text-sm text-muted-foreground">
              Certaines illustrations proviennent de{" "}
              <Link
                href="https://www.pexels.com"
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Pexels
              </Link>{" "}
              sous Pexels License (libres de droits, usage commercial autorisé,
              attribution non obligatoire mais appréciée).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              Polices &amp; icônes
            </h2>
            <ul className="space-y-1 text-sm text-foreground">
              <li>
                Police principale :{" "}
                <Link
                  href="https://rsms.me/inter/"
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Inter
                </Link>{" "}
                — SIL Open Font License
              </li>
              <li>
                Icônes :{" "}
                <Link
                  href="https://lucide.dev"
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Lucide
                </Link>{" "}
                — Licence ISC
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              Pour les formateurs
            </h2>
            <p className="text-sm text-muted-foreground">
              En téléversant une formation sur Aiduca, vous garantissez
              détenir les droits sur les contenus diffusés (vidéos, images,
              textes) ou utiliser des œuvres sous licence permettant cette
              diffusion. Les contenus de démonstration ci-dessus sont utilisés
              uniquement à des fins pédagogiques.
            </p>
          </section>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
