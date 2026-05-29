"use client";

// Hooks SSR-safe basés sur `useSyncExternalStore` — le pattern React 19
// recommandé pour lire une source client-only (localStorage/sessionStorage)
// SANS appeler `setState` dans un effet (règle react-hooks/set-state-in-effect).
//
// Côté serveur, le getServerSnapshot renvoie toujours la valeur par défaut →
// pas de hydration mismatch. Après hydratation, React relit le snapshot client
// et déclenche un re-render propre.

import { useCallback, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * `true` une fois monté côté client, `false` pendant le SSR / la 1re passe.
 * Remplace le classique `useEffect(() => setMounted(true), [])`.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

type WebStorage = "local" | "session";

function read(storage: WebStorage, key: string): string | null {
  try {
    const s = storage === "local" ? window.localStorage : window.sessionStorage;
    return s.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Valeur d'une clé de storage, réactive. Lecture seule — utile pour récupérer
 * une valeur initiale persistée (ex : code promo reporté depuis une autre page).
 * Renvoie `null` côté serveur.
 */
export function useStoredValue(storage: WebStorage, key: string): string | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const handler = (e: StorageEvent) => {
        if (e.key === null || e.key === key) onChange();
      };
      window.addEventListener("storage", handler);
      window.addEventListener(`persist:${key}`, onChange);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener(`persist:${key}`, onChange);
      };
    },
    [key],
  );
  return useSyncExternalStore(
    subscribe,
    () => read(storage, key),
    () => null,
  );
}

/**
 * État persisté dans le storage, réactif et inscriptible. Équivalent d'un
 * `useState` dont la valeur survit aux navigations et reste synchronisée.
 */
export function usePersistentState(
  storage: WebStorage,
  key: string,
  defaultValue: string,
): readonly [string, (next: string) => void] {
  const stored = useStoredValue(storage, key);
  const setValue = useCallback(
    (next: string) => {
      try {
        const s = storage === "local" ? window.localStorage : window.sessionStorage;
        s.setItem(key, next);
        window.dispatchEvent(new Event(`persist:${key}`));
      } catch {
        /* storage indisponible — non bloquant */
      }
    },
    [storage, key],
  );
  return [stored ?? defaultValue, setValue] as const;
}
