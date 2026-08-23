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
  /**
   * Second axe de comptage, combiné à l'IP — typiquement l'e-mail visé.
   *
   * Un centre de formation, c'est une salle entière derrière une seule IP
   * publique. Compter sur l'IP seule y revient à mutualiser le quota : quelques
   * fautes de frappe en début de session bloquaient tout le groupe. En comptant
   * par couple (IP, compte visé), chaque personne dispose de son propre budget
   * d'essais, et un attaquant qui s'acharne sur un compte reste freiné.
   *
   * La valeur est hachée comme l'IP : elle ne transite jamais en clair vers le
   * compteur.
   */
  scope?: string;
}

export async function checkIpRateLimit(
  opts: IpRateLimitOptions,
): Promise<RateLimitResult> {
  const ip = await clientIpHash();
  const scope = opts.scope ? `:${hashIp(opts.scope.trim().toLowerCase())}` : "";
  return checkRateLimit({
    key: `${opts.prefix}:${ip}${scope}`,
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

export interface UserRateLimitOptions {
  /** Préfixe d'identification (ex: "cart:add"). */
  prefix: string;
  /** Identifiant utilisateur (déjà authentifié). */
  userId: string;
  /** Suffixe optionnel (ex: courseId pour limiter par cours). */
  suffix?: string;
  windowMs: number;
  max: number;
}

/**
 * Rate-limit pour Server Actions authentifiées (panier, Q&A, reviews, etc.).
 * Clé : prefix:userId(:suffix). Plus précis que IP-based (un user n'est pas
 * pénalisé par un autre derrière le même NAT).
 */
export function checkUserRateLimit(
  opts: UserRateLimitOptions,
): Promise<RateLimitResult> {
  const key = opts.suffix
    ? `${opts.prefix}:${opts.userId}:${opts.suffix}`
    : `${opts.prefix}:${opts.userId}`;
  return checkRateLimit({ key, windowMs: opts.windowMs, max: opts.max });
}
