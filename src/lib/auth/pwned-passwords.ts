import "server-only";

// Vérification "Pwned Passwords" via l'API HaveIBeenPwned (k-anonymity).
//
// Principe : on hashe le mot de passe en SHA-1, on envoie SEULEMENT les 5
// premiers caractères du hash à l'API (api.pwnedpasswords.com/range/{prefix}),
// l'API renvoie tous les suffixes de hashes correspondants. On compare
// localement. Le mot de passe complet ne quitte jamais le serveur.
//
// Doc : https://haveibeenpwned.com/API/v3#PwnedPasswords

import { createHash } from "node:crypto";

import { logWarning } from "@/lib/logger";

/** Délai max pour l'appel API. Si HIBP est lent ou down on n'oblige pas l'utilisateur à attendre. */
const TIMEOUT_MS = 2500;

/** Seuil au-delà duquel un mot de passe est considéré « cramé » (rejet inscription). */
const BREACH_REJECT_THRESHOLD = 1;

export interface PwnedCheckResult {
  /** API joignable et résultat exploitable. */
  ok: boolean;
  /** Nombre de fois où le mot de passe apparaît dans les fuites publiques. */
  count: number;
  /** Doit-on rejeter l'inscription ? */
  shouldReject: boolean;
}

function sha1Upper(text: string): string {
  return createHash("sha1").update(text, "utf8").digest("hex").toUpperCase();
}

/**
 * Compte les apparitions du mot de passe dans la base HIBP. Renvoie 0 si
 * inconnu / safe. En cas d'échec API : on dégrade gracieusement (`ok: false`,
 * `shouldReject: false`) — on laisse passer l'inscription pour ne pas bloquer
 * les utilisateurs si le service tiers est en panne.
 */
export async function checkPasswordPwned(
  password: string,
): Promise<PwnedCheckResult> {
  const hash = sha1Upper(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        method: "GET",
        signal: controller.signal,
        headers: {
          "Add-Padding": "true",
          // L'user agent est requis par les conditions d'usage.
          "User-Agent": "e-formationgn-pwned-check",
        },
      },
    );
    clearTimeout(timer);

    if (!response.ok) {
      logWarning("hibp", "Réponse non-OK", { status: response.status });
      return { ok: false, count: 0, shouldReject: false };
    }

    const text = await response.text();
    let count = 0;
    for (const line of text.split("\n")) {
      const [hashSuffix, hits] = line.trim().split(":");
      if (!hashSuffix || !hits) continue;
      if (hashSuffix.toUpperCase() === suffix) {
        count = Number(hits) || 0;
        break;
      }
    }

    return {
      ok: true,
      count,
      shouldReject: count >= BREACH_REJECT_THRESHOLD,
    };
  } catch (error) {
    clearTimeout(timer);
    logWarning("hibp", "Échec de l'appel API", { error: String(error) });
    return { ok: false, count: 0, shouldReject: false };
  }
}
