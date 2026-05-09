import "server-only";

// Garde-fou anti open-redirect : on ne re-oriente que vers des chemins
// internes du site, jamais vers une URL absolue controlee par un attaquant
// via le param `?callbackUrl=` de la page connexion.

const FALLBACK = "/";

/**
 * Renvoie un chemin local sur a utiliser comme `redirectTo` post-login.
 *
 * Regles :
 * - Doit commencer par `/`
 * - Ne doit pas commencer par `//` (URL protocol-relative pointant ailleurs)
 * - Ne doit pas commencer par `/\` (variante encodee)
 * - Pas d'espace ni de caractere de controle (anti header smuggling)
 *
 * Tout ce qui ne match pas -> fallback `/`.
 */
export function safeCallbackUrl(input: unknown, fallback: string = FALLBACK): string {
  if (typeof input !== "string") return fallback;
  const value = input.trim();
  if (!value) return fallback;

  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return fallback;
  }

  if (value.length > 2048) return fallback;

  return value;
}
