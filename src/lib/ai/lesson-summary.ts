import "server-only";

// AI résumé de leçon : produit un récap pédagogique court (3-5 puces) à
// partir du texte de la leçon (textContent) et/ou de la transcription Mux.
//
// Modèle Claude Sonnet — bon compromis qualité/coût pour rédactionnel court.

import Anthropic from "@anthropic-ai/sdk";

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquant");
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export function isLessonSummaryConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface SummarizeLessonInput {
  courseTitle: string;
  lessonTitle: string;
  /** Source principale de contenu : textContent ou transcript Mux. */
  content: string;
}

const SYSTEM_PROMPT = `Tu es un assistant pédagogique francophone.
Ton job : produire un résumé structuré d'une leçon, pour aider l'élève à
préparer son visionnage et à réviser après.

Format de sortie (Markdown léger) :
1. Une intro de 1 phrase ("Cette leçon couvre…").
2. Un bloc "Points clés" avec 3-5 puces commençant par un verbe d'action.
3. Une note finale optionnelle "À retenir" (1 phrase, max).

Règles :
- Toujours en français, ton neutre et professionnel.
- Pas de gras ni d'italique excessif.
- Reste fidèle au contenu source : ne fabrique pas d'information.
- Si le contenu est trop court ou flou, dis simplement "Cette leçon n'a pas encore assez de contenu pour un résumé précis." et arrête là.
- Maximum ~200 mots au total.`;

export async function generateLessonSummary(
  input: SummarizeLessonInput,
): Promise<string> {
  const trimmed = input.content.trim();
  if (trimmed.length < 200) {
    return "Cette leçon n'a pas encore assez de contenu pour un résumé précis.";
  }

  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          `Cours : ${input.courseTitle}`,
          `Leçon : ${input.lessonTitle}`,
          "",
          "Contenu source :",
          trimmed.slice(0, 8000),
        ].join("\n"),
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Réponse IA invalide.");
  }
  return textBlock.text.trim().slice(0, 4000);
}
