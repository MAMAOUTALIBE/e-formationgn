import "server-only";

// Vérification serveur d'un token Cloudflare Turnstile (captcha gratuit,
// privacy-first, plus rapide que reCAPTCHA et sans cookie tiers).
//
// Activation : poser TURNSTILE_SECRET_KEY (serveur) + NEXT_PUBLIC_TURNSTILE_SITE_KEY
// (client). Si ces variables sont absentes, `verifyTurnstile` retourne `{ok:true}`
// → le captcha est désactivé (dev / single-user / pas encore configuré).
//
// Endpoint Cloudflare : https://challenges.cloudflare.com/turnstile/v0/siteverify
// Doc : https://developers.cloudflare.com/turnstile/get-started/server-side-validation

import { headers } from "next/headers";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileConfigured(): boolean {
  return Boolean(
    process.env.TURNSTILE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  );
}

export interface TurnstileResult {
  ok: boolean;
  /** Message à montrer à l'utilisateur en cas d'échec. */
  message?: string;
}

export async function verifyTurnstile(
  token: string | FormDataEntryValue | null,
): Promise<TurnstileResult> {
  // Pas configuré → on laisse passer. Utile en dev local et pendant la
  // période d'activation progressive.
  if (!isTurnstileConfigured()) return { ok: true };

  const tokenStr = typeof token === "string" ? token : null;
  if (!tokenStr) {
    return {
      ok: false,
      message: "Vérification anti-bot manquante. Rechargez la page et réessayez.",
    };
  }

  // IP du client — Cloudflare la corrèle avec son challenge pour détecter
  // les tokens revolés depuis une autre IP.
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;

  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY!,
    response: tokenStr,
  });
  if (ip) body.set("remoteip", ip);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!response.ok) {
      // Fail-closed : si Turnstile est down, on bloque plutôt que de laisser
      // passer. On préfère un faux positif gênant à une faille d'inscription.
      return {
        ok: false,
        message: "Vérification anti-bot indisponible. Réessayez dans un instant.",
      };
    }
    const data = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (!data.success) {
      return {
        ok: false,
        message:
          "Vérification anti-bot échouée. Rechargez la page et réessayez.",
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Vérification anti-bot indisponible. Réessayez dans un instant.",
    };
  }
}
