import type { ChatCompletion } from "groq-sdk/resources/chat/completions";

export interface GroqUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

/** Texte principal d'une réponse Groq, normalisé et borné par l'appelant. */
export function getGroqText(response: ChatCompletion): string | null {
  const text = response.choices[0]?.message.content?.trim();
  return text || null;
}

/**
 * Désérialise les arguments d'un outil précis.
 *
 * Les données restent non fiables après cette étape : chaque helper applique
 * encore ses propres validations métier avant de les utiliser.
 */
export function getGroqToolInput(
  response: ChatCompletion,
  toolName: string,
): unknown | null {
  const call = response.choices[0]?.message.tool_calls?.find(
    (candidate) => candidate.function.name === toolName,
  );
  if (!call) return null;

  try {
    const parsed: unknown = JSON.parse(call.function.arguments);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Métriques homogènes avec le contrat historique des assistants. */
export function getGroqUsage(response: ChatCompletion): GroqUsage {
  return {
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    cacheReadTokens: response.usage?.prompt_tokens_details?.cached_tokens ?? 0,
  };
}
