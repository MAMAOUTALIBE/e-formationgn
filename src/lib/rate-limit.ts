// Rate limiter en mémoire — bucket par clé (IP + endpoint).
// Suffisant pour un seul process. En multi-instance, à remplacer par Upstash
// Redis ou similaire (cf. ENV LIMIT_PROVIDER plus tard).
//
// Algo : token bucket simple. Chaque clé a `windowMs` et `max`.
// Map cleanup automatique au-delà de `windowMs * 2` pour ne pas grossir.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastCleanup = Date.now();

interface RateLimitOptions {
  /** Identifiant unique de la limite (ex: "auth:login"). */
  key: string;
  /** Durée de la fenêtre en ms. */
  windowMs: number;
  /** Nombre maximum de hits autorisés dans la fenêtre. */
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();

  // Cleanup périodique pour éviter la fuite mémoire
  if (now - lastCleanup > opts.windowMs * 2) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(key);
    }
    lastCleanup = now;
  }

  const bucket = buckets.get(opts.key);
  if (!bucket || bucket.resetAt < now) {
    const fresh: Bucket = { count: 1, resetAt: now + opts.windowMs };
    buckets.set(opts.key, fresh);
    return { ok: true, remaining: opts.max - 1, resetAt: fresh.resetAt };
  }

  if (bucket.count >= opts.max) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return {
    ok: true,
    remaining: opts.max - bucket.count,
    resetAt: bucket.resetAt,
  };
}

/**
 * Renvoie un identifiant client raisonnable pour key-er la rate limit.
 * Combine : header X-Forwarded-For (proxy/CDN) → fallback X-Real-IP
 * → fallback "anonymous". On hashe pour ne pas stocker l'IP claire.
 */
export function clientKey(headers: Headers, prefix: string): string {
  const forwarded = headers.get("x-forwarded-for");
  const real = headers.get("x-real-ip");
  const ip = (forwarded?.split(",")[0]?.trim() || real || "anonymous").slice(0, 64);
  return `${prefix}:${ip}`;
}
