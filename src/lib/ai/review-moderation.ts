import "server-only";

// AI moderation des avis : classifie un texte d'avis pour détecter spam,
// harcèlement, contenu inapproprié, ou hors-sujet (ex: critique d'un autre
// cours, lien externe vers concurrent, langage haineux).
//
// Utilise Claude Haiku — assez rapide (~500 ms) et bon marché pour ce type
// de classification binaire courte.

import Anthropic from "@anthropic-ai/sdk";

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquant");
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export function isReviewModerationConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ReviewModerationCategory =
  | "SPAM"
  | "HARASSMENT"
  | "INAPPROPRIATE"
  | "OFF_TOPIC"
  | "OK";

export interface ReviewModerationResult {
  category: ReviewModerationCategory;
  flagged: boolean;
  reason?: string;
}

const SYSTEM_PROMPT = `Tu es un classifieur de modération pour les avis publiés sur une plateforme de formation en ligne francophone.

Catégories possibles :
- SPAM : contenu publicitaire, lien externe promotionnel, mention répétée d'un autre service
- HARASSMENT : insultes ciblant le formateur, attaques personnelles, langage haineux
- INAPPROPRIATE : contenu sexuel, violent, ou choquant sans rapport avec la formation
- OFF_TOPIC : ne discute pas la formation (publicité d'une formation concurrente, message politique, plainte sans rapport)
- OK : avis légitime, même négatif ou critique, du moment qu'il porte sur la formation

Règles :
- Une critique négative argumentée = OK (les élèves ont le droit d'être insatisfaits).
- Un texte court (1-2 mots) qui n'est pas insultant = OK (peu d'info, mais pas suspect).
- Si tu hésites entre OK et une autre catégorie, choisis OK : on préfère un faux négatif à un faux positif.

Réponds UNIQUEMENT via l'outil submit_classification.`;

interface ToolInput {
  category: ReviewModerationCategory;
  reason?: string;
}

export async function classifyReviewContent(
  text: string,
): Promise<ReviewModerationResult> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { category: "OK", flagged: false };
  }
  if (trimmed.length < 10) {
    // Trop court pour être problématique — on évite l'appel API.
    return { category: "OK", flagged: false };
  }

  const client = getClient();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "submit_classification",
        description: "Soumet la classification finale.",
        input_schema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: ["SPAM", "HARASSMENT", "INAPPROPRIATE", "OFF_TOPIC", "OK"],
            },
            reason: {
              type: "string",
              description: "Courte justification (≤ 80 caractères). Vide si OK.",
              maxLength: 120,
            },
          },
          required: ["category"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_classification" },
    messages: [
      {
        role: "user",
        content: `Avis à classer :\n\n"""${trimmed.slice(0, 2000)}"""`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { category: "OK", flagged: false };
  }
  const data = toolUse.input as ToolInput;
  const flagged = data.category !== "OK";
  return {
    category: data.category,
    flagged,
    reason: flagged ? data.reason?.slice(0, 120) : undefined,
  };
}
