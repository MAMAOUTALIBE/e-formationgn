// Validateurs Aiduca-IA — entrées publiques et administration.
//
// Toutes en `.strict()` : un champ inattendu est un rejet, pas un champ ignoré.

import { z } from "zod";

import { isSafeAssistantLink } from "@/lib/assistant/contract";

/** Question posée à l'assistant. */
export const assistantQuestionSchema = z
  .object({
    question: z
      .string()
      .trim()
      .min(5, "Votre question est trop courte.")
      .max(1000, "Votre question est trop longue (1000 caractères maximum)."),
    /** Slug de la formation consultée, quand le widget est ouvert depuis sa page. */
    courseSlug: z
      .string()
      .trim()
      .max(200)
      .regex(/^[a-z0-9-]*$/, "Référence de formation invalide.")
      .optional(),
  })
  .strict();

export type AssistantQuestionInput = z.infer<typeof assistantQuestionSchema>;

/**
 * Demande de rappel par un conseiller.
 *
 * Le message est facultatif : la question qui a mené à l'escalade est déjà
 * dans la conversation, et exiger une re-saisie fait abandonner le formulaire.
 */
export const assistantLeadSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Indiquez votre nom.")
      .max(120, "Nom trop long."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Adresse e-mail invalide.")
      .max(200),
    phone: z
      .string()
      .trim()
      .max(30, "Numéro trop long.")
      .regex(/^[0-9+().\s-]*$/, "Numéro de téléphone invalide.")
      .optional()
      .or(z.literal("")),
    message: z
      .string()
      .trim()
      .max(2000, "Message trop long (2000 caractères maximum).")
      .optional()
      .or(z.literal("")),
    courseSlug: z
      .string()
      .trim()
      .max(200)
      .regex(/^[a-z0-9-]*$/)
      .optional()
      .or(z.literal("")),
    /** Consentement RGPD explicite, vérifié côté serveur. */
    consent: z
      .string()
      .refine((v) => v === "on" || v === "true", {
        message: "Vous devez accepter d'être recontacté pour envoyer la demande.",
      }),
  })
  .strict();

export type AssistantLeadInput = z.infer<typeof assistantLeadSchema>;

/** Document de la base documentaire (écran /admin/assistant/sources). */
export const assistantDocumentSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2, "Identifiant trop court.")
      .max(120)
      .regex(
        /^[a-z0-9-]+$/,
        "L'identifiant ne peut contenir que des minuscules, chiffres et tirets.",
      ),
    title: z.string().trim().min(3, "Titre trop court.").max(200),
    category: z.string().trim().min(2, "Indiquez une catégorie.").max(80),
    body: z
      .string()
      .trim()
      .min(20, "Le contenu est trop court pour être utile à l'assistant.")
      .max(50_000, "Contenu trop long (50 000 caractères maximum)."),
    sourceLabel: z.string().trim().max(200).optional().or(z.literal("")),
    /**
     * Chemin interne uniquement : un lien absolu enverrait l'utilisateur hors
     * du site, et `isSafeAssistantLink` le retirerait de toute façon.
     */
    sourceUrl: z
      .string()
      .trim()
      .max(300)
      .regex(/^\/[^\s]*$/, "Indiquez un chemin interne, par exemple /aide.")
      .refine((value) => value === "" || isSafeAssistantLink(value), {
        message: "Cette page n'est pas une route publique autorisée.",
      })
      .optional()
      .or(z.literal("")),
    isPublished: z.coerce.boolean(),
    position: z.coerce.number().int().min(0).max(9999),
  })
  .strict();

export type AssistantDocumentInput = z.infer<typeof assistantDocumentSchema>;

/** Changement de statut d'un prospect. */
export const assistantLeadStatusSchema = z
  .object({
    leadId: z.string().trim().min(1).max(60),
    status: z.enum(["NEW", "IN_PROGRESS", "CLOSED"]),
    internalNote: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .strict();
