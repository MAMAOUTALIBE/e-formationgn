import Link from "next/link";
import { Compass, Home, LifeBuoy, Search } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

// Page 404 du site.
//
// Sans ce fichier, Next servait sa page par défaut : « 404 — This page could
// not be found », en anglais, sans en-tête ni pied de page, sur un site dont
// toute l'interface est en français. La personne arrivée là par un lien
// périmé n'avait aucun chemin de retour.
//
// Ce fichier couvre aussi, par construction, toutes les URL qui ne
// correspondent à aucune route — cf. la documentation `not-found.js` de
// Next 16 : « the root app/not-found.js handles any unmatched URLs ».

/** Les trois portes de sortie utiles depuis une impasse. */
const EXITS = [
  {
    href: "/",
    icon: Home,
    title: "Accueil",
    description: "Repartir de la page d'accueil.",
  },
  {
    href: "/cours",
    icon: Compass,
    title: "Catalogue",
    description: "Parcourir toutes les formations disponibles.",
  },
  {
    href: "/aide",
    icon: LifeBuoy,
    title: "Centre d'aide",
    description: "Trouver une réponse ou nous contacter.",
  },
] as const;

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 py-16 sm:py-24">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Erreur 404
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Cette page n&apos;existe pas
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              Le lien est peut-être périmé, ou la formation que vous cherchiez
              n&apos;est plus publiée. Voici par où continuer.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/cours">
                  <Search className="mr-2 size-4" aria-hidden="true" />
                  Parcourir le catalogue
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Retour à l&apos;accueil</Link>
              </Button>
            </div>
          </div>

          <ul className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3">
            {EXITS.map((exit) => (
              <li key={exit.href}>
                <Link
                  href={exit.href}
                  className="flex h-full flex-col rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-foreground/25 hover:bg-accent"
                >
                  <exit.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                  <span className="mt-3 font-semibold">{exit.title}</span>
                  <span className="mt-1 text-sm text-muted-foreground">
                    {exit.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
