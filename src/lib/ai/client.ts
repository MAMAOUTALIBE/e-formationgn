import "server-only";

// Client Groq partagé par tous les assistants de src/lib/ai/.
//
// Les helpers conservent une dégradation gracieuse : sans GROQ_API_KEY, leur
// garde de configuration masque la fonctionnalité et aucun appel n'est tenté.

import Groq from "groq-sdk";

export {
  getGroqText,
  getGroqToolInput,
  getGroqUsage,
  type GroqUsage,
} from "@/lib/ai/groq-response";

let cachedClient: Groq | null = null;

/** Vrai si la clé Groq serveur est présente. */
export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

/** Client Groq mémoïsé pour le processus. */
export function getGroqClient(featureLabel: string): Groq {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      `${featureLabel} non configuré. Renseignez GROQ_API_KEY dans .env.`,
    );
  }

  cachedClient = new Groq({ apiKey });
  return cachedClient;
}
