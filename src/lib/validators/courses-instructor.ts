// Schémas Zod pour les opérations formateur (création, édition, programme).
// Toutes les Server Actions doivent valider via ces schémas avant toute
// mutation Prisma.

import { z } from "zod";

import { COURSE_LEVELS } from "./courses";
import { PLACEHOLDER_DESCRIPTION } from "./course-publish";

const slugFromTitle = z
  .string()
  .trim()
  .min(5, "Le titre doit contenir au moins 5 caractères.")
  .max(120, "Le titre ne peut pas dépasser 120 caractères.");

// URL de média de couverture (image OU vidéo) : accepte une URL absolue
// http(s) (R2 / domaine public) OU un chemin local servi par l'app
// (/uploads/… quand R2 n'est pas configuré).
const coverMediaUrl = z
  .string()
  .trim()
  .refine(
    (v) => /^https?:\/\//.test(v) || v.startsWith("/uploads/"),
    "URL de média invalide.",
  )
  .optional()
  .or(z.literal(""));

export const createCourseSchema = z
  .object({
    title: slugFromTitle,
    categoryId: z.string().min(1, "Sélectionnez une catégorie."),
    thumbnailUrl: coverMediaUrl,
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
      .min(50, "Décrivez votre formation en au moins 50 caractères.")
      .max(8000, "La description est trop longue.")
      .refine((d) => d !== PLACEHOLDER_DESCRIPTION, {
        message: "Remplacez le texte par défaut par une vraie description.",
      }),
    categoryId: z.string().min(1, "Sélectionnez une catégorie."),
    level: z.enum(COURSE_LEVELS),
    thumbnailUrl: coverMediaUrl,
  })
  .strict();
export type UpdateCourseGeneralInput = z.infer<typeof updateCourseGeneralSchema>;

// Helpers de validation des prix
//   - EUR / USD : 2 décimales, plafonnées à 9 999 (limite raisonnable)
//   - GNF : entier ≥ 0, plafonné à 99 999 999 (≈ 10 000 € au taux actuel)
//   - XOF : entier ≥ 0, plafonné à 9 999 999 (≈ 15 000 € au taux fixe)

const decimalPrice = (label: string) =>
  z.coerce
    .number({ error: `${label} requis.` })
    .min(0, "Le prix ne peut pas être négatif.")
    .max(9999, "Prix trop élevé.");

const integerPrice = (label: string, max: number) =>
  z.coerce
    .number({ error: `${label} requis.` })
    .int("Doit être un entier.")
    .min(0, "Le prix ne peut pas être négatif.")
    .max(max, "Prix trop élevé.");

const optionalDecimal = z
  .union([z.coerce.number().min(0).max(9999), z.literal(""), z.null()])
  .optional();
const optionalIntegerGnf = z
  .union([z.coerce.number().int().min(0).max(99_999_999), z.literal(""), z.null()])
  .optional();
const optionalIntegerXof = z
  .union([z.coerce.number().int().min(0).max(9_999_999), z.literal(""), z.null()])
  .optional();

export const updateCoursePricingSchema = z
  .object({
    priceEUR: decimalPrice("Prix EUR"),
    priceUSD: decimalPrice("Prix USD"),
    priceGNF: integerPrice("Prix GNF", 99_999_999),
    priceXOF: integerPrice("Prix XOF", 9_999_999),
    discountPriceEUR: optionalDecimal,
    discountPriceUSD: optionalDecimal,
    discountPriceGNF: optionalIntegerGnf,
    discountPriceXOF: optionalIntegerXof,
    discountEndsAt: z
      .union([z.string().datetime(), z.literal("")])
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const checks: Array<[
      string,
      number | string | null | undefined,
      number,
      string,
    ]> = [
      ["discountPriceEUR", data.discountPriceEUR, data.priceEUR, "EUR"],
      ["discountPriceUSD", data.discountPriceUSD, data.priceUSD, "USD"],
      ["discountPriceGNF", data.discountPriceGNF, data.priceGNF, "GNF"],
      ["discountPriceXOF", data.discountPriceXOF, data.priceXOF, "XOF"],
    ];
    for (const [path, discount, full, label] of checks) {
      if (discount === undefined || discount === "" || discount === null) continue;
      if (Number(discount) >= full) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [path],
          message: `Le prix promotionnel ${label} doit être inférieur au prix normal.`,
        });
      }
    }
  });
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

// URL vidéo externe (lien direct .mp4/.webm/.mov ou hébergement tiers servant
// un fichier lisible par la balise <video>). Validée http/https + longueur.
export const lessonVideoUrlSchema = z
  .object({
    url: z
      .string()
      .trim()
      .max(2000, "URL trop longue.")
      .refine(
        // URL publique http(s) (lien direct / R2) OU chemin local servi par
        // l'app (/uploads/… quand R2 n'est pas configuré, upload de fichier).
        (u) => /^https?:\/\//i.test(u) || u.startsWith("/uploads/"),
        "L'URL doit être un lien http(s) ou un fichier téléversé.",
      ),
  })
  .strict();

// Ressource téléchargeable jointe à une leçon. `url` suit la même règle que
// la vidéo externe : lien public http(s) (R2) ou chemin servi par l'app quand
// le stockage objet n'est pas configuré.
export const lessonResourceSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Donnez un nom à la ressource.")
      .max(160, "Nom trop long."),
    url: z
      .string()
      .trim()
      .max(2000, "URL trop longue.")
      .refine(
        (u) => /^https?:\/\//i.test(u) || u.startsWith("/uploads/"),
        "L'URL doit être un lien http(s) ou un fichier téléversé.",
      ),
    // Métadonnée d'affichage uniquement : le plafond réel dépend du type et
    // est appliqué par la route de presign (aucun pour la vidéo). Le borner
    // ici rejetterait l'enregistrement d'une vidéo pourtant déjà téléversée.
    fileSizeBytes: z.coerce.number().int().positive().safe().optional(),
  })
  .strict();
export type LessonResourceInput = z.infer<typeof lessonResourceSchema>;

export const reorderItemsSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(200),
  })
  .strict();
