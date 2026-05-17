"use client";

// Mode focus pour la page leçon : cache la sidebar curriculum pour ne
// laisser que le player + tabs. Toggle via un bouton dans le header
// apprentissage. État persisté en localStorage pour conserver le choix
// entre leçons.
//
// Architecture : un seul composant client racine qui :
//  - applique une classe CSS au document.body (`focus-mode`) → la sidebar
//    écoute via `:has` / classe parent
//  - expose un bouton "Mode focus" rendu via un portail inutile : on rend
//    juste le bouton dans le header avec le hook `useFocusMode`.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

const STORAGE_KEY = "gandal:learning-focus";

interface FocusModeContextValue {
  focus: boolean;
  toggle: () => void;
}

const Ctx = createContext<FocusModeContextValue | null>(null);

export function FocusModeProvider({ children }: { children: React.ReactNode }) {
  const [focus, setFocus] = useState(false);

  // Hydrate depuis localStorage au premier mount (pas de SSR mismatch :
  // on démarre toujours à false côté serveur, le client met à jour ensuite).
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setFocus(true);
    } catch {
      /* localStorage indisponible (private mode) — non bloquant */
    }
  }, []);

  // Synchronise la classe sur <body> pour que la sidebar puisse réagir
  // sans avoir besoin de prop drilling.
  useEffect(() => {
    document.body.classList.toggle("learning-focus", focus);
    try {
      if (focus) window.localStorage.setItem(STORAGE_KEY, "1");
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* idem */
    }
    return () => {
      document.body.classList.remove("learning-focus");
    };
  }, [focus]);

  const toggle = useCallback(() => setFocus((f) => !f), []);

  return <Ctx.Provider value={{ focus, toggle }}>{children}</Ctx.Provider>;
}

export function useFocusMode(): FocusModeContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useFocusMode doit être utilisé dans FocusModeProvider");
  }
  return ctx;
}

export function FocusModeToggle() {
  const { focus, toggle } = useFocusMode();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={focus}
      aria-label={focus ? "Quitter le mode focus" : "Activer le mode focus"}
      title={focus ? "Quitter le mode focus" : "Mode focus (cache le programme)"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {focus ? (
        <Minimize2 className="h-5 w-5" aria-hidden />
      ) : (
        <Maximize2 className="h-5 w-5" aria-hidden />
      )}
    </button>
  );
}
