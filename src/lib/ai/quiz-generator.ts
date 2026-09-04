import "server-only";

// AI génération de quiz : produit 3-5 questions à choix multiples à partir
// du contenu d'une leçon (textContent ou transcript Mux).
//
// Modèle Groq rapide + tool use (output JSON contraint). On limite la
// génération à 5 questions max pour rester sous la limite de sortie et éviter du
// contenu peu pertinent.

import { z } from "zod";

import { getGroqClient, getGroqToolInput, isGroqConfigured } from "@/lib/ai/client";
import { MODEL_FAST } from "@/lib/ai/models";

export function isQuizGenConfigured(): boolean {
  return isGroqConfigured();
}

export type GeneratedQuestionKind = "SINGLE_CHOICE" | "TRUE_FALSE";

export interface GeneratedQuizOption {
  label: string;
  isCorrect: boolean;
}

export interface GeneratedQuizQuestion {
  prompt: string;
  kind: GeneratedQuestionKind;
  options: GeneratedQuizOption[];
  explanation?: string;
}

export interface GenerateQuizInput {
  courseTitle: string;
  lessonTitle: string;
  content: string;
  /** Nombre de questions souhaitées (3-5, plafonné côté serveur). */
  count?: number;
}

const SYSTEM_PROMPT = `Tu crées des questions de quiz pédagogiques (français) à partir d'une leçon.

Règles strictes :
- Chaque question est clairement formulée, sans ambiguïté.
- Type SINGLE_CHOICE : 4 options, exactement 1 marquée isCorrect=true.
- Type TRUE_FALSE : 2 options "Vrai"/"Faux", exactement 1 marquée isCorrect=true.
- Les distracteurs (mauvaises réponses) sont plausibles mais clairement faux selon le contenu.
- Tu ne fabriques RIEN qui ne soit pas dans le contenu source.
- Couvre les concepts importants de la leçon, pas des détails marginaux.
- Une explication courte (1-2 phrases) accompagne chaque question.

Si le contenu est trop court ou trop générique pour produire un quiz pertinent, renvoie un tableau vide.

Réponds UNIQUEMENT via l'outil submit_quiz.`;

const TOOL_INPUT_SCHEMA = z
  .object({
    questions: z
      .array(
        z
          .object({
            prompt: z.string().min(5).max(500),
            kind: z.enum(["SINGLE_CHOICE", "TRUE_FALSE"]),
            options: z
              .array(
                z
                  .object({
                    label: z.string().min(1).max(300),
                    isCorrect: z.boolean(),
                  })
                  .strict(),
              )
              .min(2)
              .max(6),
            explanation: z.string().max(500).optional(),
          })
          .strict(),
      )
      .max(5),
  })
  .strict();

export async function generateQuizFromLesson(
  input: GenerateQuizInput,
): Promise<GeneratedQuizQuestion[]> {
  const trimmed = input.content.trim();
  if (trimmed.length < 300) {
    return [];
  }
  const target = Math.min(5, Math.max(3, input.count ?? 4));

  const client = getGroqClient("Génération de quiz IA");
  const response = await client.chat.completions.create({
    model: MODEL_FAST,
    max_completion_tokens: 2000,
    reasoning_effort: "low",
    citation_options: "disabled",
    parallel_tool_calls: false,
    tools: [
      {
        type: "function",
        function: {
          name: "submit_quiz",
          description: "Soumet la liste finale de questions de quiz.",
          parameters: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                minItems: 0,
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    prompt: { type: "string", maxLength: 500 },
                    kind: { type: "string", enum: ["SINGLE_CHOICE", "TRUE_FALSE"] },
                    options: {
                      type: "array",
                      minItems: 2,
                      maxItems: 6,
                      items: {
                        type: "object",
                        properties: {
                          label: { type: "string", maxLength: 300 },
                          isCorrect: { type: "boolean" },
                        },
                        required: ["label", "isCorrect"],
                      },
                    },
                    explanation: { type: "string", maxLength: 500 },
                  },
                  required: ["prompt", "kind", "options"],
                },
              },
            },
            required: ["questions"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "submit_quiz" } },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `Formation : ${input.courseTitle}`,
          `Leçon : ${input.lessonTitle}`,
          `Nombre de questions souhaitées : ${target}`,
          "",
          "Contenu source :",
          trimmed.slice(0, 8000),
        ].join("\n"),
      },
    ],
  });

  const parsed = TOOL_INPUT_SCHEMA.safeParse(
    getGroqToolInput(response, "submit_quiz"),
  );
  if (!parsed.success) return [];
  const data = parsed.data;

  // Validation finale côté serveur (le modèle peut déraper malgré tool schema).
  return data.questions
    .filter((q) => {
      const correctCount = q.options.filter((o) => o.isCorrect === true).length;
      if (correctCount !== 1) return false;
      return true;
    })
    .slice(0, 5)
    .map((q) => ({
      prompt: q.prompt.trim().slice(0, 500),
      kind: q.kind,
      options: q.options.slice(0, 6).map((o) => ({
        label: o.label.trim().slice(0, 300),
        isCorrect: o.isCorrect,
      })),
      explanation: q.explanation?.trim().slice(0, 500),
    }));
}
