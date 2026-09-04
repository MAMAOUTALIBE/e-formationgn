import { z } from "zod";

/**
 * Données recueillies par le parcours guidé de la page Contact.
 *
 * Le schéma reste distinct du formulaire d'escalade du widget global : ici,
 * tous les renseignements sont demandés progressivement et sont obligatoires.
 */
export const contactAssistantLeadSchema = z
  .object({
    need: z
      .string()
      .trim()
      .min(5, "Décrivez votre besoin en quelques mots.")
      .max(2000, "Votre besoin est trop long (2000 caractères maximum)."),
    name: z
      .string()
      .trim()
      .min(2, "Indiquez votre nom.")
      .max(120, "Nom trop long.")
      .regex(/^[^\r\n]+$/, "Le nom doit tenir sur une ligne."),
    company: z
      .string()
      .trim()
      .min(2, "Indiquez votre entreprise ou précisez « Particulier ».")
      .max(160, "Nom d'entreprise trop long.")
      .regex(/^[^\r\n]+$/, "Le nom de l'entreprise doit tenir sur une ligne."),
    phone: z
      .string()
      .trim()
      .max(30, "Numéro trop long.")
      .regex(/^[0-9+(). \t-]+$/, "Numéro de téléphone invalide.")
      .refine((value) => value.replace(/\D/g, "").length >= 6, {
        message: "Indiquez un numéro de téléphone complet.",
      }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Adresse e-mail invalide.")
      .max(200),
    training: z
      .string()
      .trim()
      .min(2, "Indiquez la formation recherchée.")
      .max(300, "Intitulé de formation trop long.")
      .regex(/^[^\r\n]+$/, "La formation doit tenir sur une ligne."),
    availability: z
      .string()
      .trim()
      .min(2, "Indiquez votre disponibilité.")
      .max(300, "Disponibilité trop longue."),
    consent: z.boolean().refine((value) => value, {
      message: "Votre consentement est nécessaire avant l'envoi.",
    }),
  })
  .strict();

export type ContactAssistantLeadInput = z.infer<
  typeof contactAssistantLeadSchema
>;

/**
 * Format lisible immédiatement par la liste Prospects existante du CRM.
 * La source est imposée ici, côté serveur, et ne dépend jamais du navigateur.
 */
export function buildContactProspectMessage(
  data: ContactAssistantLeadInput,
): string {
  const need = oneLine(data.need);
  const availability = oneLine(data.availability);
  const summary = [
    `${data.name} représente ${data.company}.`,
    `La formation recherchée est « ${data.training} ».`,
    `Besoin exprimé : ${need}`,
    `Disponibilité annoncée : ${availability}.`,
  ].join(" ");

  return [
    "Source : Aiduca-IA",
    `Entreprise : ${data.company}`,
    `Formation recherchée : ${data.training}`,
    `Disponibilité : ${availability}`,
    "",
    "Résumé de la conversation :",
    summary,
  ].join("\n");
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ");
}
