import { z } from "zod";

import { isSupportedTimeZone, zonedDateTimeToUtc } from "@/lib/time-zone";

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || null);

export const virtualClassFormSchema = z
  .object({
    title: z.string().trim().min(3, "Le titre doit contenir au moins 3 caractères.").max(180),
    description: optionalText(4_000),
    agenda: optionalText(8_000),
    trainingSessionId: z.string().trim().min(1, "Sélectionnez une session."),
    instructorId: z.string().trim().min(1, "Sélectionnez un formateur."),
    startsAt: z.string().datetime({ local: true }),
    durationMinutes: z.coerce.number().int().min(15).max(8 * 60),
    // Refusé à la saisie plutôt que toléré : un fuseau inconnu du moteur ICU
    // fait lever `Intl.DateTimeFormat` au rendu, et les cartes de séance sont
    // listées côté admin, formateur ET apprenant — une seule ligne corrompue
    // renvoyait donc une 500 sur les trois espaces.
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine(isSupportedTimeZone, "Fuseau horaire inconnu (attendu : « Europe/Paris »)."),
    maxParticipants: z
      .union([z.literal(""), z.coerce.number().int().min(2).max(500)])
      .transform((value) => (value === "" ? null : value)),
    earlyJoinMinutes: z.coerce.number().int().min(0).max(120),
    recordingEnabled: z.boolean(),
    status: z.enum(["DRAFT", "SCHEDULED"]),
  })
  .transform((value) => {
    // `datetime-local` renvoie une heure murale sans décalage. La lire avec
    // `new Date()` l'ancrait sur le fuseau du processus — juste sur un poste
    // en Europe/Paris, décalé dans le conteneur (UTC). Le fuseau déclaré sur
    // la séance fait autorité.
    const startsAt = zonedDateTimeToUtc(value.startsAt, value.timezone);
    return {
      ...value,
      startsAt,
      scheduledEndAt: new Date(startsAt.getTime() + value.durationMinutes * 60_000),
    };
  });

export const cancelVirtualClassSchema = z.object({
  reason: z.string().trim().min(3, "Précisez le motif de l’annulation.").max(1_000),
});

export const virtualClassMessageSchema = z.object({
  content: z.string().trim().min(1).max(2_000),
  type: z.enum(["MESSAGE", "QUESTION"]).default("MESSAGE"),
});

export const virtualClassResourceSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: optionalText(1_000),
  storageUrl: z.string().trim().min(1).max(2_000),
  contentType: z.string().trim().min(1).max(180),
  fileSizeBytes: z.coerce.number().int().positive().max(1_073_741_824).nullable(),
  visibility: z.enum(["BEFORE", "DURING", "AFTER", "ALWAYS"]),
  downloadable: z.boolean(),
});
