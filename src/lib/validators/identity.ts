// Schémas d'état civil, partagés par la création de compte et la correction
// d'identité. Un seul jeu de règles : les deux écrans écrivent les mêmes
// colonnes, ils ne peuvent pas admettre des valeurs différentes.

import { z } from "zod";

/** Borne basse de plausibilité : au-delà, c'est une faute de saisie. */
const OLDEST_PLAUSIBLE_BIRTH_YEAR = 1900;

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Nom et prénom requis.")
  .max(160, "Nom trop long.");

/**
 * Date de naissance issue d'un `<input type="date">` — donc « AAAA-MM-JJ » ou
 * la chaîne vide quand le champ n'est pas rempli.
 *
 * Construite en UTC à midi : à minuit, un serveur à l'ouest de Greenwich
 * reculerait la date d'un jour au moment d'écrire la colonne `DATE`.
 */
export const birthDateSchema = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .refine(
    (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
    "Date invalide.",
  )
  .transform((value) => (value === null ? null : new Date(`${value}T12:00:00Z`)))
  .refine(
    (value) => value === null || !Number.isNaN(value.getTime()),
    "Date invalide.",
  )
  .refine(
    (value) => value === null || value.getTime() <= Date.now(),
    "La date de naissance ne peut pas être dans le futur.",
  )
  .refine(
    (value) => value === null || value.getUTCFullYear() >= OLDEST_PLAUSIBLE_BIRTH_YEAR,
    "Date de naissance improbable — vérifiez l'année.",
  );

/** Vide = non renseigné, ce qui reste distinct de « autre ». */
export const genderSchema = z
  .enum(["", "FEMALE", "MALE", "OTHER"])
  .transform((value) => (value === "" ? null : value));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value));

export const civilStatusSchema = z.object({
  fullName: fullNameSchema,
  birthDate: birthDateSchema,
  birthPlace: optionalText(160),
  gender: genderSchema,
  phone: optionalText(40),
  country: optionalText(80),
  address: optionalText(500),
});

export type CivilStatusInput = z.infer<typeof civilStatusSchema>;

/** Lecture d'un `FormData` vers la forme attendue par le schéma. */
export function readCivilStatusFields(formData: FormData) {
  return {
    fullName: String(formData.get("fullName") ?? ""),
    birthDate: String(formData.get("birthDate") ?? ""),
    birthPlace: String(formData.get("birthPlace") ?? ""),
    gender: String(formData.get("gender") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    country: String(formData.get("country") ?? ""),
    address: String(formData.get("address") ?? ""),
  };
}

/** Cet écran crée exclusivement des apprenants. L'équipe a son propre flux. */
export const CREATABLE_ACCOUNT_ROLES = ["STUDENT"] as const;

export const createCenterAccountSchema = civilStatusSchema
  .extend({
    email: z.string().trim().toLowerCase().email("Email invalide."),
    role: z.enum(CREATABLE_ACCOUNT_ROLES),
    // Identifiant d'une société EXISTANTE, jamais un nom saisi librement :
    // deux orthographes du même client fausseraient tout regroupement
    // (facturation, dossier OPCO, statistiques).
    companyId: z.string().trim().optional().default(""),
  })
  .strict()
  .refine((v) => v.companyId !== "", {
    message: "Sélectionnez la société de rattachement.",
    path: ["companyId"],
  });

export const updateAccountIdentitySchema = civilStatusSchema.extend({
  userId: z.string().min(1),
});
