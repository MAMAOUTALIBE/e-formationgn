import { z } from "zod";

// Règle mot de passe : 8+ caractères, au moins une lettre et un chiffre.
// (Compromis raisonnable entre sécurité et UX. Renforcer si besoin métier.)
export const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(72, "Le mot de passe ne peut pas dépasser 72 caractères.")
  .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre.")
  .regex(/\d/, "Le mot de passe doit contenir au moins un chiffre.");

export const registerSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, "Le prénom doit contenir au moins 2 caractères.")
      .max(60, "Le prénom est trop long."),
    lastName: z
      .string()
      .trim()
      .min(2, "Le nom doit contenir au moins 2 caractères.")
      .max(60, "Le nom est trop long."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Adresse email invalide."),
    password: passwordSchema,
    acceptTerms: z.boolean().refine((v) => v, {
      message: "Vous devez accepter les CGU et la politique de confidentialité.",
    }),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Adresse email invalide."),
    password: z.string().min(1, "Le mot de passe est requis."),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

export const requestPasswordResetSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Adresse email invalide."),
  })
  .strict();

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, "Jeton invalide."),
    password: passwordSchema,
  })
  .strict();

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(2).max(60),
    lastName: z.string().trim().min(2).max(60),
    headline: z.string().trim().max(120).optional().or(z.literal("")),
    bio: z.string().trim().max(2000).optional().or(z.literal("")),
    websiteUrl: z.string().trim().url("URL invalide.").optional().or(z.literal("")),
    linkedinUrl: z.string().trim().url("URL invalide.").optional().or(z.literal("")),
    facebookUrl: z.string().trim().url("URL invalide.").optional().or(z.literal("")),
    twitterUrl: z.string().trim().url("URL invalide.").optional().or(z.literal("")),
    youtubeUrl: z.string().trim().url("URL invalide.").optional().or(z.literal("")),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Un apprenant ne peut enrichir que les informations publiques de son profil.
// Son identité est gérée par l'administration et n'entre jamais dans cette
// validation, même si une requête forgée envoie des champs supplémentaires.
export const updateStudentPublicProfileSchema = updateProfileSchema.omit({
  firstName: true,
  lastName: true,
}).strip();

export type UpdateStudentPublicProfileInput = z.infer<
  typeof updateStudentPublicProfileSchema
>;
