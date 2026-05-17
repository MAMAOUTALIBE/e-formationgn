// Rate limiter distribué — Upstash Redis (REST) en prod, fallback mémoire
// en dev. Le fallback mémoire ne peut PAS être utilisé en multi-instance
// (chaque pod a son propre compteur → un attaquant brute-force N× le quota).
//
// Activation Upstash : poser UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
// Le swap est transparent côté appelant (mêmes signatures).
//
// Algo : fenêtre fixe par bucket de temps. Clé Redis incluant le windowStart
// pour que les compteurs s'auto-expirent naturellement à la fin du window.

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

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export function isDistributedRateLimitEnabled(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  if (isDistributedRateLimitEnabled()) {
    return checkUpstash(opts);
  }
  return checkInMemory(opts);
}

function checkInMemory(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();

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

// Upstash REST : pipeline INCR + PEXPIRE NX. La clé inclut le windowStart
// pour éviter de devoir gérer le reset (Redis l'expire tout seul).
// En cas d'erreur réseau → fail-open (on laisse passer) plutôt que de bloquer
// le site entier si Upstash est down. C'est un trade-off : on accepte un peu
// d'abus pendant une panne Redis plutôt qu'un déni de service auto-infligé.
async function checkUpstash(opts: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / opts.windowMs) * opts.windowMs;
  const resetAt = windowStart + opts.windowMs;
  const redisKey = `rl:${opts.key}:${windowStart}`;
  const ttlSec = Math.ceil(opts.windowMs / 1000) + 5;

  try {
    const response = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, String(ttlSec), "NX"],
      ]),
      // 1.5s : si Upstash ne répond pas, on fail-open.
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    if (!response.ok) return failOpen(opts, resetAt);
    const json = (await response.json()) as Array<{ result?: number; error?: string }>;
    const count = json[0]?.result;
    if (typeof count !== "number") return failOpen(opts, resetAt);

    if (count > opts.max) {
      return { ok: false, remaining: 0, resetAt };
    }
    return { ok: true, remaining: Math.max(0, opts.max - count), resetAt };
  } catch {
    return failOpen(opts, resetAt);
  }
}

function failOpen(opts: RateLimitOptions, resetAt: number): RateLimitResult {
  return { ok: true, remaining: opts.max - 1, resetAt };
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
