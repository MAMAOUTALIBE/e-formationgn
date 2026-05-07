// Schémas de validation pour les codes promo créés par les formateurs.
// Plus restreints que ceux de l'admin : scope toujours COURSE_SPECIFIC,
// liste des cours obligatoire, et chaque courseId est vérifié côté serveur
// (l'action s'assure qu'ils appartiennent bien au formateur connecté).

import { z } from "zod";

export const instructorPromoCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[A-Z0-9_-]+$/, "Majuscules, chiffres, tirets ou underscores."),
    kind: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    value: z.coerce.number().int().min(1),
    currency: z.enum(["EUR", "USD"]).optional(),
    courseIds: z.array(z.string().min(1)).min(1, "Sélectionnez au moins un cours."),
    maxRedemptions: z
      .union([z.coerce.number().int().min(1), z.literal("")])
      .optional(),
    endsAt: z.string().optional().or(z.literal("")),
    isActive: z.coerce.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.kind === "PERCENTAGE" && data.value > 9_999) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Maximum 9999 bps (≈ 99,99 %).",
      });
    }
  });

export type InstructorPromoCreateInput = z.infer<typeof instructorPromoCreateSchema>;
