"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Dans l'assistant de création de cours : quand un formulaire d'étape est
 * enregistré avec succès, on enchaîne automatiquement vers l'étape suivante
 * (`nextHref`). Un court délai laisse le temps de lire le message de succès.
 *
 * Sans `nextHref` (dernière étape), aucune navigation : le formulaire affiche
 * simplement sa confirmation.
 */
export function useAdvanceOnSuccess(
  success: boolean,
  nextHref?: string | null,
): void {
  const router = useRouter();
  const advanced = useRef(false);

  useEffect(() => {
    if (!success || !nextHref || advanced.current) return;
    advanced.current = true;
    const timer = setTimeout(() => {
      router.push(nextHref);
    }, 650);
    return () => clearTimeout(timer);
  }, [success, nextHref, router]);
}
