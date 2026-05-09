import "server-only";

// AI génération de quiz : produit 3-5 questions à choix multiples à partir
// du contenu d'une leçon (textContent ou transcript Mux).
//
// Modèle Claude Sonnet + tool use (output JSON contraint). On limite la
// génération à 5 questions max pour rester sous max_tokens et éviter du
// contenu peu pertinent.

import Anthropic from "@anthropic-ai/sdk";

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquant");
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export function isQuizGenConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
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

interface ToolInput {
  questions: Array<{
    prompt: string;
    kind: "SINGLE_CHOICE" | "TRUE_FALSE";
    options: Array<{ label: string; isCorrect: boolean }>;
    explanation?: string;
  }>;
}

export async function generateQuizFromLesson(
  input: GenerateQuizInput,
): Promise<GeneratedQuizQuestion[]> {
  const trimmed = input.content.trim();
  if (trimmed.length < 300) {
    return [];
  }
  const target = Math.min(5, Math.max(3, input.count ?? 4));

  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: "submit_quiz",
        description: "Soumet la liste finale de questions de quiz.",
        input_schema: {
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
    ],
    tool_choice: { type: "tool", name: "submit_quiz" },
    messages: [
      {
        role: "user",
        content: [
          `Cours : ${input.courseTitle}`,
          `Leçon : ${input.lessonTitle}`,
          `Nombre de questions souhaitées : ${target}`,
          "",
          "Contenu source :",
          trimmed.slice(0, 8000),
        ].join("\n"),
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return [];
  }
  const data = toolUse.input as ToolInput;

  // Validation finale côté serveur (le modèle peut déraper malgré tool schema).
  return data.questions
    .filter((q) => {
      if (typeof q.prompt !== "string" || q.prompt.trim().length < 5) return false;
      if (!["SINGLE_CHOICE", "TRUE_FALSE"].includes(q.kind)) return false;
      if (!Array.isArray(q.options) || q.options.length < 2) return false;
      const correctCount = q.options.filter((o) => o.isCorrect === true).length;
      if (correctCount !== 1) return false;
      return true;
    })
    .slice(0, 5)
    .map((q) => ({
      prompt: q.prompt.trim().slice(0, 500),
      kind: q.kind as GeneratedQuestionKind,
      options: q.options.slice(0, 6).map((o) => ({
        label: String(o.label).trim().slice(0, 300),
        isCorrect: Boolean(o.isCorrect),
      })),
      explanation: q.explanation?.trim().slice(0, 500),
    }));
}
