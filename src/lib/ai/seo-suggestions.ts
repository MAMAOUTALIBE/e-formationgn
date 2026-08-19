import "server-only";

// AI SEO suggestions — propose meta title, meta description et points clés
// "ce que vous allez apprendre" à partir du titre + description du cours.
//
// Modèle : Claude Sonnet (plus rapide + moins coûteux que Opus pour du
// court rédactionnel). Pas de cache car les requêtes sont uniques par cours.

import Anthropic from "@anthropic-ai/sdk";

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI non configuré. Renseignez ANTHROPIC_API_KEY dans .env.",
    );
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export function isSeoAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface SeoSuggestionInput {
  title: string;
  subtitle?: string;
  description: string;
  categoryName?: string;
  level?: string;
}

export interface SeoSuggestion {
  metaTitle: string;
  metaDescription: string;
  whatYouWillLearn: string[];
}

const SYSTEM_PROMPT = `Tu es un expert SEO francophone spécialisé en formation en ligne.
Ton job : produire 3 éléments à partir d'un brouillon de formation :
1. metaTitle : titre SEO optimisé (60 caractères max, accroche claire)
2. metaDescription : description SEO (155 caractères max, action + bénéfice)
3. whatYouWillLearn : tableau de 4 à 6 puces concrètes, chacune commençant par un verbe d'action.

Règles :
- Français naturel, ton professionnel et accessible
- Pas d'emojis sauf strictement nécessaire
- Pas de superlatifs vides ("incroyable", "le meilleur")
- Réponds UNIQUEMENT en JSON valide selon le schéma fourni — aucun texte avant ou après.`;

interface ToolInputSchema {
  metaTitle: string;
  metaDescription: string;
  whatYouWillLearn: string[];
}

export async function generateSeoSuggestions(
  input: SeoSuggestionInput,
): Promise<SeoSuggestion> {
  const client = getClient();

  const userMessage = [
    `Titre : ${input.title}`,
    input.subtitle ? `Sous-titre : ${input.subtitle}` : null,
    input.categoryName ? `Catégorie : ${input.categoryName}` : null,
    input.level ? `Niveau : ${input.level}` : null,
    `\nDescription du formateur :\n${input.description.slice(0, 4000)}`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "submit_seo",
        description: "Soumet la proposition SEO finale.",
        input_schema: {
          type: "object",
          properties: {
            metaTitle: {
              type: "string",
              description: "Titre SEO (60 chars max)",
              maxLength: 70,
            },
            metaDescription: {
              type: "string",
              description: "Description SEO (155 chars max)",
              maxLength: 170,
            },
            whatYouWillLearn: {
              type: "array",
              items: { type: "string", maxLength: 140 },
              minItems: 3,
              maxItems: 7,
              description: "Bullets concrètes commençant par un verbe d'action",
            },
          },
          required: ["metaTitle", "metaDescription", "whatYouWillLearn"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_seo" },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Le modèle n'a pas renvoyé de proposition SEO valide.");
  }
  const data = toolUse.input as ToolInputSchema;

  // Garde-fous longueur côté serveur (au cas où le modèle déborde)
  return {
    metaTitle: data.metaTitle.slice(0, 70).trim(),
    metaDescription: data.metaDescription.slice(0, 170).trim(),
    whatYouWillLearn: data.whatYouWillLearn
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .slice(0, 7)
      .map((s) => s.slice(0, 140).trim()),
  };
}
