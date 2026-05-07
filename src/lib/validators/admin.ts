import { z } from "zod";

export const moderateCourseSchema = z
  .object({
    courseId: z.string().min(1),
    action: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .strict()
  .refine((data) => data.action !== "reject" || (data.reason && data.reason.length > 5), {
    message: "Précisez la raison du refus.",
    path: ["reason"],
  });

export const userActionSchema = z
  .object({
    userId: z.string().min(1),
    action: z.enum(["suspend", "reactivate", "promote_admin", "demote_admin"]),
  })
  .strict();

export const categorySchema = z
  .object({
    id: z.string().optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9-]+$/, "Lettres minuscules, chiffres et tirets uniquement."),
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500).optional().or(z.literal("")),
    iconName: z.string().trim().max(40).optional().or(z.literal("")),
    displayOrder: z.coerce.number().int().min(0).max(999).default(0),
    isActive: z.coerce.boolean().default(true),
  })
  .strict();

export const commissionRateSchema = z
  .object({
    source: z.enum(["INSTRUCTOR_DRIVEN", "PLATFORM_DRIVEN"]),
    rateBps: z.coerce.number().int().min(0).max(10_000),
    description: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .strict();

export const promoCodeSchema = z
  .object({
    id: z.string().optional(),
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[A-Z0-9_-]+$/, "Majuscules, chiffres, tirets ou underscores."),
    kind: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    scope: z.enum(["GLOBAL", "COURSE_SPECIFIC"]).default("GLOBAL"),
    value: z.coerce.number().int().min(1),
    currency: z.enum(["EUR", "USD"]).optional(),
    maxRedemptions: z
      .union([z.coerce.number().int().min(1), z.literal("")])
      .optional(),
    startsAt: z.union([z.string().datetime(), z.literal("")]).optional(),
    endsAt: z.union([z.string().datetime(), z.literal("")]).optional(),
    isActive: z.coerce.boolean().default(true),
  })
  .strict();

export const cmsPageSchema = z
  .object({
    id: z.string().optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9-]+$/, "Lettres minuscules, chiffres et tirets."),
    title: z.string().trim().min(2).max(160),
    body: z.string().trim().min(10).max(50_000),
    isPublished: z.coerce.boolean().default(false),
  })
  .strict();
