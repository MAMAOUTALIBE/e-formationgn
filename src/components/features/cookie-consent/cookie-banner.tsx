"use client";

// Bandeau RGPD minimaliste — l'application n'utilise que des cookies
// strictement nécessaires (session, sécurité, préférences d'interface).
// Pas de tracker publicitaire. On utilise useSyncExternalStore pour lire
// localStorage de façon SSR-safe sans setState dans un useEffect.

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "efg_cookie_ok";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function readAccepted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

/**
 * Réserve initiale, avant que le bandeau ait pu être mesuré.
 *
 * Cette valeur était utilisée telle quelle : elle sous-estime la hauteur
 * réelle sur écran étroit, où le bandeau passe en colonne et dépasse les
 * 7,5 rem. La mesure ci-dessous la remplace dès le premier rendu.
 */
const BANNER_SPACE_FALLBACK = "7.5rem";

/** Marge entre le bandeau et ce qui se pose au-dessus de lui. */
const BANNER_GAP_PX = 24;

/**
 * Variable CSS publiée tant que le bandeau est visible.
 *
 * Le `padding-bottom` du body ne décale pas les éléments `position: fixed`.
 * Le bouton flottant d'Aiduca-IA se retrouvait donc SOUS le bandeau, et un
 * visiteur n'ayant pas encore accepté les cookies ne pouvait pas ouvrir
 * l'assistant du tout. Plutôt que de coder en dur la géométrie de ce bandeau
 * dans l'autre composant, on expose la mesure ici : c'est le bandeau qui sait
 * combien de place il prend.
 */
const BANNER_SPACE_VAR = "--cookie-banner-space";

export function CookieBanner() {
  // SSR : on assume "accepté" pour éviter d'afficher un bandeau qui flash.
  // Hydratation : on lit la vraie valeur dans localStorage.
  const accepted = useSyncExternalStore(subscribe, readAccepted, () => true);
  const [dismissed, setDismissed] = useState(false);
  const bandeauRef = useRef<HTMLDivElement>(null);
  const visible = !accepted && !dismissed;

  // Tant que le bandeau est là, la page lui réserve sa place.
  //
  // `padding-bottom` empêche le pied de page de rester définitivement masqué.
  // `scroll-padding-bottom` est la pièce décisive : c'est lui qui garantit
  // qu'un élément amené à l'écran — par une ancre, par la tabulation, ou par
  // `scrollIntoView` — ne s'arrête jamais SOUS le bandeau. Sans lui, les
  // onglets du lecteur de leçon se retrouvaient dessous et leurs clics étaient
  // absorbés par le bandeau (WCAG 2.2 — 2.4.11 « Focus Not Obscured »).
  useEffect(() => {
    if (!visible) return;
    const racine = document.documentElement;
    const scrollPrecedent = racine.style.scrollPaddingBottom;
    const paddingPrecedent = document.body.style.paddingBottom;

    // La hauteur est MESURÉE, pas devinée : sur écran étroit le bandeau passe
    // en colonne et dépasse largement la réserve forfaitaire. Une réserve trop
    // courte laisse le bandeau recouvrir ce qui se pose au-dessus de lui — le
    // bouton flottant de l'assistant s'y retrouvait inatteignable sur mobile.
    const appliquer = () => {
      const hauteur = bandeauRef.current?.offsetHeight;
      const espace = hauteur
        ? `${hauteur + BANNER_GAP_PX}px`
        : BANNER_SPACE_FALLBACK;
      racine.style.scrollPaddingBottom = espace;
      document.body.style.paddingBottom = espace;
      racine.style.setProperty(BANNER_SPACE_VAR, espace);
    };

    appliquer();
    const observateur = new ResizeObserver(appliquer);
    if (bandeauRef.current) observateur.observe(bandeauRef.current);
    window.addEventListener("resize", appliquer);

    return () => {
      observateur.disconnect();
      window.removeEventListener("resize", appliquer);
      racine.style.scrollPaddingBottom = scrollPrecedent;
      document.body.style.paddingBottom = paddingPrecedent;
      racine.style.removeProperty(BANNER_SPACE_VAR);
    };
  }, [visible]);

  function handleAccept() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  if (!visible) return null;

  return (
    // `role="region"` et non `role="dialog"` : ce bandeau n'est pas modal, ne
    // piège pas le focus et n'attend pas de décision — l'annoncer comme un
    // dialogue trompait les lecteurs d'écran.
    <div
      ref={bandeauRef}
      role="region"
      aria-label="Information sur les cookies"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-lg border border-border bg-card p-4 shadow-lg sm:inset-x-auto sm:right-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground">
          Aiduca utilise uniquement des cookies nécessaires au
          fonctionnement (session, sécurité et préférences d&apos;interface). Pas de
          traceur publicitaire.{" "}
          <Link href="/cookies" className="text-[color:var(--brand-secondary)] underline underline-offset-4 hover:no-underline">
            En savoir plus
          </Link>
          .
        </p>
        <Button type="button" onClick={handleAccept}>
          J&apos;ai compris
        </Button>
      </div>
    </div>
  );
}
