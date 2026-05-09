import "server-only";

// Mux service — orchestration au-dessus du SDK bas niveau (lib/mux.ts).
//
// Pourquoi : `deleteAsset` est appelé en best-effort dans 3 endroits de
// curriculum.ts. En cas d'erreur réseau ponctuelle, l'asset Mux reste orphelin
// (et continue d'être facturé). Ce service ajoute un retry borné + un
// fallback de logging propre.

import { deleteAsset, isMuxConfigured } from "@/lib/mux";
import { logWarning } from "@/lib/logger";

export interface DeleteAssetOptions {
  /** Nombre max de tentatives (par défaut 3). */
  maxAttempts?: number;
  /** Délai initial entre tentatives, doublé à chaque échec (ms). */
  initialBackoffMs?: number;
  /** Contexte pour le logger (lessonId, action, etc.). */
  context?: Record<string, unknown>;
}

/**
 * Supprime un asset Mux avec retry exponentiel borné. Ne lève jamais : si
 * toutes les tentatives échouent, on logue + on signale via Sentry et on
 * retourne `false`. Le caller décide quoi faire (généralement : continuer
 * sans bloquer la suppression de la leçon).
 */
export async function safeDeleteMuxAsset(
  assetId: string,
  options: DeleteAssetOptions = {},
): Promise<boolean> {
  if (!isMuxConfigured()) {
    return false;
  }

  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const initialBackoff = Math.max(50, options.initialBackoffMs ?? 200);

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await deleteAsset(assetId);
      return true;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delay = initialBackoff * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logWarning("mux", "Suppression d'asset échouée après retries", {
    assetId,
    maxAttempts,
    error: String(lastError),
    ...options.context,
  });
  return false;
}
