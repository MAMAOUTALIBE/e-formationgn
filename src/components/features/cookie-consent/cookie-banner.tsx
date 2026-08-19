"use client";

// Bandeau RGPD minimaliste — l'application n'utilise que des cookies
// strictement nécessaires (session, sécurité, préférences d'interface).
// Pas de tracker publicitaire. On utilise useSyncExternalStore pour lire
// localStorage de façon SSR-safe sans setState dans un useEffect.

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

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

export function CookieBanner() {
  // SSR : on assume "accepté" pour éviter d'afficher un bandeau qui flash.
  // Hydratation : on lit la vraie valeur dans localStorage.
  const accepted = useSyncExternalStore(subscribe, readAccepted, () => true);
  const [dismissed, setDismissed] = useState(false);

  function handleAccept() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  if (accepted || dismissed) return null;

  return (
    <div
      role="dialog"
      aria-label="Information sur les cookies"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-lg border border-border bg-card p-4 shadow-lg sm:inset-x-auto sm:right-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground">
          Aiduca utilise uniquement des cookies nécessaires au
          fonctionnement (session, sécurité et préférences d&apos;interface). Pas de
          traceur publicitaire.{" "}
          <Link href="/cookies" className="text-[color:var(--brand-secondary)] hover:underline">
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
