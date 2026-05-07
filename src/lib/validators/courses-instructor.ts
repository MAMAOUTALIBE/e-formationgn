// Schémas Zod pour les opérations formateur (création, édition, programme).
// Toutes les Server Actions doivent valider via ces schémas avant toute
// mutation Prisma.

import { z } from "zod";

import { COURSE_LEVELS } from "./courses";

const slugFromTitle = z
  .string()
  .trim()
  .min(5, "Le titre doit contenir au moins 5 caractères.")
  .max(120, "Le titre ne peut pas dépasser 120 caractères.");

export const createCourseSchema = z
  .object({
    title: slugFromTitle,
    categoryId: z.string().min(1, "Sélectionnez une catégorie."),
  })
  .strict();
export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const updateCourseGeneralSchema = z
  .object({
    title: slugFromTitle,
    subtitle: z
      .string()
      .trim()
      .max(200, "Le sous-titre ne peut pas dépasser 200 caractères.")
      .optional()
      .or(z.literal("")),
    description: z
      .string()
      .trim()
      .min(50, "Décrivez votre cours en au moins 50 caractères.")
      .max(8000, "La description est trop longue."),
    categoryId: z.string().min(1, "Sélectionnez une catégorie."),
    level: z.enum(COURSE_LEVELS),
    thumbnailUrl: z
      .string()
      .trim()
      .url("URL d'image invalide.")
      .optional()
      .or(z.literal("")),
  })
  .strict();
export type UpdateCourseGeneralInput = z.infer<typeof updateCourseGeneralSchema>;

export const updateCoursePricingSchema = z
  .object({
    priceEUR: z.coerce
      .number({ error: "Prix EUR requis." })
      .min(0, "Le prix ne peut pas être négatif.")
      .max(9999, "Prix trop élevé."),
    priceUSD: z.coerce
      .number({ error: "Prix USD requis." })
      .min(0, "Le prix ne peut pas être négatif.")
      .max(9999, "Prix trop élevé."),
    discountPriceEUR: z
      .union([z.coerce.number().min(0).max(9999), z.literal(""), z.null()])
      .optional(),
    discountPriceUSD: z
      .union([z.coerce.number().min(0).max(9999), z.literal(""), z.null()])
      .optional(),
    discountEndsAt: z
      .union([z.string().datetime(), z.literal("")])
      .optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.discountPriceEUR === undefined ||
      data.discountPriceEUR === "" ||
      data.discountPriceEUR === null ||
      Number(data.discountPriceEUR) < data.priceEUR,
    {
      message: "Le prix promotionnel EUR doit être inférieur au prix normal.",
      path: ["discountPriceEUR"],
    },
  )
  .refine(
    (data) =>
      data.discountPriceUSD === undefined ||
      data.discountPriceUSD === "" ||
      data.discountPriceUSD === null ||
      Number(data.discountPriceUSD) < data.priceUSD,
    {
      message: "Le prix promotionnel USD doit être inférieur au prix normal.",
      path: ["discountPriceUSD"],
    },
  );
export type UpdateCoursePricingInput = z.infer<typeof updateCoursePricingSchema>;

export const stringList = z
  .string()
  .trim()
  .max(2000)
  .transform((value) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 20),
  );

export const updateCourseSeoSchema = z
  .object({
    metaTitle: z
      .string()
      .trim()
      .max(120, "Trop long (120 caractères max).")
      .optional()
      .or(z.literal("")),
    metaDescription: z
      .string()
      .trim()
      .max(280, "Trop long (280 caractères max).")
      .optional()
      .or(z.literal("")),
    whatYouWillLearn: stringList,
    requirements: stringList,
    targetAudience: stringList,
  })
  .strict();
export type UpdateCourseSeoInput = z.infer<typeof updateCourseSeoSchema>;

export const sectionSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Donnez un titre à la section.")
      .max(120, "Titre trop long."),
    description: z
      .string()
      .trim()
      .max(500)
      .optional()
      .or(z.literal("")),
  })
  .strict();
export type SectionInput = z.infer<typeof sectionSchema>;

export const lessonSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Donnez un titre à la leçon.")
      .max(160, "Titre trop long."),
    type: z.enum(["VIDEO", "TEXT", "QUIZ", "RESOURCE"]),
    description: z
      .string()
      .trim()
      .max(500)
      .optional()
      .or(z.literal("")),
    textContent: z.string().trim().max(50_000).optional().or(z.literal("")),
    resourceUrl: z
      .string()
      .trim()
      .url("URL invalide.")
      .optional()
      .or(z.literal("")),
    resourceFileName: z.string().trim().max(160).optional().or(z.literal("")),
    isFreePreview: z.coerce.boolean().optional(),
  })
  .strict();
export type LessonInput = z.infer<typeof lessonSchema>;

export const reorderItemsSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(200),
  })
  .strict();
