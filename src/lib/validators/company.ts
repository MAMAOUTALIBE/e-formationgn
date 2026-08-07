// Validation des sociétés clientes.
//
// `.strict()` partout : un champ inconnu envoyé par le client est rejeté
// plutôt qu'ignoré silencieusement.

import { z } from "zod";

/** Chaîne optionnelle : le formulaire envoie "" là où la base veut NULL. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

/**
 * SIRET : 14 chiffres. SIREN : 9. On accepte les espaces à la saisie (les
 * documents officiels les impriment groupés) et on les retire avant stockage,
 * sinon deux écritures du même numéro passeraient la contrainte d'unicité.
 */
const siret = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, ""))
  .refine((v) => v === "" || /^\d{14}$/.test(v), {
    message: "Le SIRET doit comporter 14 chiffres.",
  })
  .transform((v) => (v === "" ? null : v))
  .nullable();

const siren = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, ""))
  .refine((v) => v === "" || /^\d{9}$/.test(v), {
    message: "Le SIREN doit comporter 9 chiffres.",
  })
  .transform((v) => (v === "" ? null : v))
  .nullable();

const optionalEmail = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase())
  .refine((v) => v === "" || z.string().email().safeParse(v).success, {
    message: "Adresse e-mail invalide.",
  })
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const companySchema = z
  .object({
    // Seul champ obligatoire : sans raison sociale, la fiche n'identifie rien.
    // Le SIRET reste facultatif — un client étranger ou une administration
    // peut ne pas en avoir.
    name: z.string().trim().min(2, "La raison sociale est obligatoire.").max(200),
    siret,
    siren,
    vatNumber: optionalText(30),
    addressLine1: optionalText(200),
    addressLine2: optionalText(200),
    postalCode: optionalText(20),
    city: optionalText(120),
    country: z.string().trim().min(2).max(80).default("France"),
    contactName: optionalText(160),
    contactEmail: optionalEmail,
    contactPhone: optionalText(40),
    opco: optionalText(120),
    opcoReference: optionalText(80),
    notes: optionalText(5000),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  })
  .strict();

export type CompanyInput = z.infer<typeof companySchema>;
