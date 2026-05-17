"use client";

// Contexte partagé pour le `useTransition` qui gouverne les changements de
// filtre du catalogue. Les composants déclencheurs (sidebar, top bar, drawer)
// appellent `startTransition` depuis ici, et la zone résultats lit `pending`
// pour afficher un état de chargement (opacity + skeleton).
//
// Sans ce contexte, chaque filtre a son propre useTransition local et la
// grille n'a aucun moyen de savoir qu'un changement est en cours.

import * as React from "react";

interface FilterTransitionContextValue {
  pending: boolean;
  startTransition: React.TransitionStartFunction;
}

const FilterTransitionContext = React.createContext<FilterTransitionContextValue | null>(
  null,
);

export function FilterTransitionProvider({ children }: { children: React.ReactNode }) {
  const [pending, startTransition] = React.useTransition();
  const value = React.useMemo(
    () => ({ pending, startTransition }),
    [pending, startTransition],
  );
  return (
    <FilterTransitionContext.Provider value={value}>
      {children}
    </FilterTransitionContext.Provider>
  );
}

/**
 * À utiliser dans les composants client qui modifient les filtres
 * (push URL). Fallback automatique sur un useTransition local si
 * pas de provider — l'app reste fonctionnelle même hors catalogue.
 */
export function useFilterTransition(): FilterTransitionContextValue {
  const ctx = React.useContext(FilterTransitionContext);
  // Hooks must be called unconditionally — toujours créer un local fallback,
  // l'utiliser uniquement si pas de contexte.
  const [localPending, localStart] = React.useTransition();
  if (ctx) return ctx;
  return { pending: localPending, startTransition: localStart };
}
