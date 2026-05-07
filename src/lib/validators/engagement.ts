import { z } from "zod";

export const reviewSchema = z
  .object({
    courseId: z.string().min(1),
    rating: z.coerce.number().int().min(1).max(5),
    title: z.string().trim().max(120).optional().or(z.literal("")),
    comment: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .strict();

export const questionSchema = z
  .object({
    courseId: z.string().min(1),
    title: z.string().trim().min(5).max(160),
    body: z.string().trim().min(10).max(4000),
  })
  .strict();

export const answerSchema = z
  .object({
    questionId: z.string().min(1),
    body: z.string().trim().min(2).max(4000),
  })
  .strict();
