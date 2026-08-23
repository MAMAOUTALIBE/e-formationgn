"use client";

// Bandeau RGPD minimaliste — l'application n'utilise que des cookies
// strictement nécessaires (session, sécurité, préférences d'interface).
// Pas de tracker publicitaire. On utilise useSyncExternalStore pour lire
// localStorage de façon SSR-safe sans setState dans un useEffect.

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

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

/** Hauteur réservée sous la page tant que le bandeau est affiché. */
const BANNER_SPACE = "7.5rem";

export function CookieBanner() {
  // SSR : on assume "accepté" pour éviter d'afficher un bandeau qui flash.
  // Hydratation : on lit la vraie valeur dans localStorage.
  const accepted = useSyncExternalStore(subscribe, readAccepted, () => true);
  const [dismissed, setDismissed] = useState(false);
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
    racine.style.scrollPaddingBottom = BANNER_SPACE;
    document.body.style.paddingBottom = BANNER_SPACE;
    return () => {
      racine.style.scrollPaddingBottom = scrollPrecedent;
      document.body.style.paddingBottom = paddingPrecedent;
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
