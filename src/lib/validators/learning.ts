import { z } from "zod";

export const lessonProgressSchema = z
  .object({
    lessonId: z.string().min(1),
    watchedSeconds: z.coerce.number().min(0).max(86_400).optional(),
    lastPositionSeconds: z.coerce.number().min(0).max(86_400).optional(),
    isCompleted: z.coerce.boolean().optional(),
  })
  .strict();

export const lessonNoteSchema = z
  .object({
    lessonId: z.string().min(1),
    content: z.string().trim().min(1).max(5000),
    videoTimestampSeconds: z.coerce.number().min(0).max(86_400).optional(),
  })
  .strict();

export const quizQuestionKindSchema = z.enum([
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "IMAGE_CHOICE",
  "DRAG_DROP",
  "HOTSPOT",
]);

const optionalMediaUrl = z.string().trim().max(2048).optional().or(z.literal(""));
const dragTargetSchema = z
  .object({
    id: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,40}$/),
    label: z.string().trim().min(1).max(160),
  })
  .strict();
const hotspotAnswerSchema = z
  .object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    radius: z.number().min(2).max(30),
  })
  .strict();

export const quizQuestionSchema = z
  .object({
    prompt: z.string().trim().min(5).max(500),
    explanation: z.string().trim().max(1000).optional().or(z.literal("")),
    kind: quizQuestionKindSchema,
    points: z.coerce.number().int().min(1).max(10).default(1),
    imageUrl: optionalMediaUrl,
    imageAlt: z.string().trim().max(300).optional().or(z.literal("")),
    interactionConfig: z
      .object({ targets: z.array(dragTargetSchema).min(2).max(6) })
      .strict()
      .optional(),
    answerConfig: hotspotAnswerSchema.optional(),
    options: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(300),
            isCorrect: z.boolean(),
            imageUrl: optionalMediaUrl,
            imageAlt: z.string().trim().max(300).optional().or(z.literal("")),
            targetId: z.string().trim().max(40).optional().or(z.literal("")),
          })
          .strict(),
      )
      .max(8, "8 options maximum."),
  })
  .strict()
  .superRefine((data, ctx) => {
    const issue = (message: string, path: (string | number)[] = ["options"]) =>
      ctx.addIssue({ code: "custom", message, path });

    if (data.kind === "HOTSPOT") {
      if (!data.imageUrl) issue("Ajoutez l’image sur laquelle l’élève doit cliquer.", ["imageUrl"]);
      if (!data.answerConfig) issue("Cliquez sur l’image pour définir la zone correcte.", ["answerConfig"]);
      if (data.options.length !== 0) issue("Une zone cliquable ne doit pas contenir d’options.");
      return;
    }

    if (data.options.length < 2) issue("Au moins 2 options.");

    if (data.kind === "DRAG_DROP") {
      const targets = data.interactionConfig?.targets ?? [];
      const targetIds = new Set(targets.map((target) => target.id));
      if (targetIds.size !== targets.length) issue("Chaque catégorie doit être unique.", ["interactionConfig"]);
      if (targets.length < 2) issue("Ajoutez au moins deux catégories.", ["interactionConfig"]);
      if (data.options.some((option) => !option.targetId || !targetIds.has(option.targetId))) {
        issue("Associez chaque carte à sa catégorie correcte.");
      }
      return;
    }

    const correctCount = data.options.filter((option) => option.isCorrect).length;
    if (correctCount === 0) issue("Au moins une option doit être correcte.");
    if (data.kind !== "MULTIPLE_CHOICE" && correctCount !== 1) {
      issue("Une seule réponse doit être correcte pour ce type de question.");
    }
    if (data.kind === "TRUE_FALSE" &&
      (data.options.length !== 2 || data.options[0]?.label !== "Vrai" || data.options[1]?.label !== "Faux")) {
      issue("Une question Vrai/Faux doit proposer les réponses Vrai et Faux.");
    }
    if (data.kind === "IMAGE_CHOICE" && data.options.some((option) => !option.imageUrl)) {
      issue("Ajoutez une image à chaque réponse proposée.");
    }
  });
export type QuizQuestionInput = z.infer<typeof quizQuestionSchema>;

export const quizMetaSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).optional().or(z.literal("")),
    passingScore: z.coerce.number().int().min(0).max(100).default(70),
    maxAttempts: z
      .union([z.coerce.number().int().min(1).max(50), z.literal("")])
      .optional(),
  })
  .strict();

export const quizAttemptSubmitSchema = z
  .object({
    answers: z
      .array(
        z
          .object({
            questionId: z.string().min(1),
            optionIds: z.array(z.string().min(1)).max(8),
            placements: z
              .array(
                z.object({ optionId: z.string().min(1), targetId: z.string().min(1).max(40) }).strict(),
              )
              .max(8)
              .optional(),
            point: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).strict().optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
