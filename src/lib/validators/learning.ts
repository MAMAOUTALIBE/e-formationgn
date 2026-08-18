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

export const quizQuestionSchema = z
  .object({
    prompt: z.string().trim().min(5).max(500),
    explanation: z.string().trim().max(1000).optional().or(z.literal("")),
    kind: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"]),
    points: z.coerce.number().int().min(1).max(10).default(1),
    options: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(300),
            isCorrect: z.boolean(),
          })
          .strict(),
      )
      .min(2, "Au moins 2 options.")
      .max(8, "8 options maximum."),
  })
  .strict()
  .refine((data) => data.options.some((o) => o.isCorrect), {
    message: "Au moins une option doit être correcte.",
    path: ["options"],
  })
  .refine(
    (data) =>
      data.kind === "MULTIPLE_CHOICE" ||
      data.options.filter((option) => option.isCorrect).length === 1,
    {
      message: "Une seule réponse doit être correcte pour ce type de question.",
      path: ["options"],
    },
  )
  .refine(
    (data) =>
      data.kind !== "TRUE_FALSE" ||
      (data.options.length === 2 &&
        data.options[0]?.label === "Vrai" &&
        data.options[1]?.label === "Faux"),
    {
      message: "Une question Vrai/Faux doit proposer les réponses Vrai et Faux.",
      path: ["options"],
    },
  );
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
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
