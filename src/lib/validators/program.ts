// Validation des formations (programmes) et de leurs sessions.

import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

export const programSchema = z
  .object({
    title: z.string().trim().min(2, "L'intitulé est obligatoire.").max(200),
    code: optionalText(40),
    description: optionalText(5000),
    // Durée réglementaire en heures : bornée haut pour attraper une saisie
    // aberrante (un zéro de trop), pas pour brider un parcours long.
    durationHours: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 5000), {
        message: "Durée invalide (1 à 5000 heures).",
      })
      .nullable(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  })
  .strict();

export const sessionSchema = z
  .object({
    programId: z.string().trim().min(1, "Programme de formation obligatoire."),
    reference: optionalText(60),
    startDate: z.string().trim().min(1, "Date de début obligatoire."),
    endDate: z.string().trim().min(1, "Date de fin obligatoire."),
    location: optionalText(160),
    capacity: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 10000), {
        message: "Capacité invalide.",
      })
      .nullable(),
    status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"]).default("PLANNED"),
    notes: optionalText(5000),
  })
  .strict()
  // Une session qui finit avant de commencer produirait des conventions et des
  // feuilles d'émargement incohérentes : on refuse à la saisie.
  .refine(
    (v) => {
      const start = new Date(v.startDate);
      const end = new Date(v.endDate);
      return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start;
    },
    { message: "La date de fin doit suivre la date de début.", path: ["endDate"] },
  );

export type ProgramInput = z.infer<typeof programSchema>;
export type SessionInput = z.infer<typeof sessionSchema>;
