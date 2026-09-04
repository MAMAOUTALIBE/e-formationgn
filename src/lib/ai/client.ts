import "server-only";

// Client Anthropic partagé par tous les assistants de src/lib/ai/.
//
// Chaque helper portait auparavant sa propre copie du même singleton paresseux.
// Sept copies d'un même bloc, c'est sept endroits où corriger une option de
// client (timeout, retries, en-tête) et six occasions de l'oublier.
//
// Le contrat documenté dans CLAUDE.md ne change pas : une seule variable
// ANTHROPIC_API_KEY, un garde `isXxxConfigured()` par fonctionnalité, et une
// dégradation gracieuse côté appelant. `getAnthropicClient()` lève si la clé
// manque — c'est voulu : le garde est ce qui empêche d'y arriver.

import Anthropic from "@anthropic-ai/sdk";

let cachedClient: Anthropic | null = null;

/**
 * Vrai si la clé API est présente. Toutes les fonctions `isXxxConfigured()`
 * des assistants délèguent ici.
 */
export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Client Anthropic mémoïsé pour le processus.
 *
 * @param featureLabel Nom de la fonctionnalité, cité dans le message d'erreur
 *   pour que la trace dise laquelle a été appelée sans garde.
 */
export function getAnthropicClient(featureLabel: string): Anthropic {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      `${featureLabel} non configuré. Renseignez ANTHROPIC_API_KEY dans .env.`,
    );
  }

  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}
