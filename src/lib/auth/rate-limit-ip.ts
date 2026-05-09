import "server-only";

// Helpers de rate-limiting basés sur l'adresse IP, utilisables depuis les
// Server Actions (auth/inscription/reset). On hashe l'IP pour ne pas la
// stocker en clair dans le bucket en mémoire.

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { checkRateLimit, type RateLimitResult } from "@/lib/rate-limit";

const HASH_SALT =
  process.env.RATE_LIMIT_IP_SALT ?? process.env.NEXTAUTH_SECRET ?? "ef-rl-salt";

function hashIp(ip: string): string {
  return createHash("sha256").update(`${HASH_SALT}:${ip}`).digest("hex").slice(0, 16);
}

export async function clientIpHash(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const real = h.get("x-real-ip");
  const ip =
    (forwarded?.split(",")[0]?.trim() || real || "anonymous").slice(0, 64);
  return hashIp(ip);
}

export interface IpRateLimitOptions {
  /** Préfixe d'identification (ex: "auth:login"). */
  prefix: string;
  /** Durée de la fenêtre en ms. */
  windowMs: number;
  /** Nombre max d'occurrences dans la fenêtre. */
  max: number;
}

export async function checkIpRateLimit(
  opts: IpRateLimitOptions,
): Promise<RateLimitResult> {
  const ip = await clientIpHash();
  return checkRateLimit({
    key: `${opts.prefix}:${ip}`,
    windowMs: opts.windowMs,
    max: opts.max,
  });
}

export function rateLimitMessage(resetAt: number): string {
  const seconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  if (seconds < 60) return `Trop d'essais. Réessayez dans ${seconds} s.`;
  const minutes = Math.ceil(seconds / 60);
  return `Trop d'essais. Réessayez dans ${minutes} min.`;
}
