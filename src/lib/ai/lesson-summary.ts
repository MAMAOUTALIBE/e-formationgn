import "server-only";

// AI résumé de leçon : produit un récap pédagogique court (3-5 puces) à
// partir du texte de la leçon (textContent) et/ou de la transcription Mux.
//
// Modèle Groq rapide — bon compromis qualité/coût pour du rédactionnel court.

import { getGroqClient, getGroqText, isGroqConfigured } from "@/lib/ai/client";
import { MODEL_FAST } from "@/lib/ai/models";

export function isLessonSummaryConfigured(): boolean {
  return isGroqConfigured();
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

  const client = getGroqClient("Résumé de leçon IA");
  const response = await client.chat.completions.create({
    model: MODEL_FAST,
    max_completion_tokens: 600,
    reasoning_effort: "low",
    citation_options: "disabled",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `Formation : ${input.courseTitle}`,
          `Leçon : ${input.lessonTitle}`,
          "",
          "Contenu source :",
          trimmed.slice(0, 8000),
        ].join("\n"),
      },
    ],
  });

  const text = getGroqText(response);
  if (!text) {
    throw new Error("Réponse IA invalide.");
  }
  return text.slice(0, 4000);
}
