import "server-only";

// Cache distribué read-through, alimenté par Upstash Redis (REST).
//
// Pourquoi pas seulement `unstable_cache` de Next ?
//   - unstable_cache est PAR-INSTANCE en mémoire. À 10 instances, on a
//     10 caches qui se réchauffent indépendamment → DB sollicitée 10×.
//   - Pas d'invalidation cross-instance (impossible de purger toutes les
//     instances depuis une mutation admin).
//   - Pas de visibilité (hit rate, taille, TTL).
//
// On garde unstable_cache pour les pages statiques (ISR friendly), et on
// ajoute ce cache Redis-backed pour les payloads coûteux/réutilisables
// (course detail, instructor public, category trees, leaderboards).
//
// Fallback : si Upstash n'est pas configuré, on délègue directement au
// fetcher (pas de cache). Pas de fallback in-memory ici — le risque d'incohérence
// inter-instance est pire que pas de cache.

import { logWarning } from "@/lib/logger";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export function isDistributedCacheEnabled(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

export interface CacheOptions {
  /** Clé Redis (préfixée par "cache:" en interne). Identifie uniquement la ressource. */
  key: string;
  /** TTL en secondes. Recommandé : 60-600 pour pages publiques, 5-30 pour leaderboards. */
  ttlSeconds: number;
  /** Si true, ignore le cache (force le refresh). Utile pour debug. */
  bypass?: boolean;
}

/**
 * Pattern read-through : retourne la valeur cachée si présente, sinon
 * appelle `fetcher`, met en cache et retourne. Toute erreur Redis est
 * silencieuse (fail-open vers la DB) pour ne jamais casser une page.
 */
export async function cached<T>(
  opts: CacheOptions,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (!isDistributedCacheEnabled() || opts.bypass) {
    return fetcher();
  }
  const redisKey = `cache:${opts.key}`;

  // GET
  try {
    const response = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(redisKey)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      signal: AbortSignal.timeout(800),
      cache: "no-store",
    });
    if (response.ok) {
      const json = (await response.json()) as { result?: string | null };
      if (typeof json.result === "string") {
        try {
          return JSON.parse(json.result) as T;
        } catch {
          /* corruption — on tombe sur le fetcher */
        }
      }
    }
  } catch {
    /* fail-open vers le fetcher */
  }

  // MISS → DB
  const value = await fetcher();

  // SET (fire-and-forget : on ne bloque pas la réponse)
  void setCache(redisKey, value, opts.ttlSeconds);

  return value;
}

async function setCache(redisKey: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const body = JSON.stringify(value);
    // Garde-fou : ne pas spammer Redis avec des payloads géants
    // (Mux thumbnails, course descriptions verbeux, etc.).
    if (body.length > 256 * 1024) {
      logWarning("cache", "payload > 256KB — skip set", {
        key: redisKey,
        sizeBytes: body.length,
      });
      return;
    }
    await fetch(`${UPSTASH_URL}/setex/${encodeURIComponent(redisKey)}/${ttlSeconds}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "content-type": "text/plain",
      },
      body,
      signal: AbortSignal.timeout(800),
      cache: "no-store",
    });
  } catch {
    /* fail-open : un set raté n'a pas d'impact correctness */
  }
}

/**
 * Invalide une ou plusieurs clés (utile depuis une mutation admin ou un
 * webhook). Pattern recommandé : `cache:course:${slug}`.
 */
export async function invalidate(keys: string | string[]): Promise<void> {
  if (!isDistributedCacheEnabled()) return;
  const list = (Array.isArray(keys) ? keys : [keys]).map((k) => `cache:${k}`);
  try {
    await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(list.map((k) => ["DEL", k])),
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
  } catch {
    /* fail-open */
  }
}
