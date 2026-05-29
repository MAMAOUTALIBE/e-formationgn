import { z } from "zod";

// Validators Zod pour les règles de modération.
// Les enums reflètent prisma/schema.prisma (ModerationRuleKind / Action) :
// un cast brut côté Server Action laissait passer une valeur invalide jusqu'à
// la contrainte DB (erreur non gérée). Ces schémas la rejettent proprement.

export const moderationRuleSchema = z
  .object({
    name: z.string().min(1).max(120),
    kind: z.enum(["KEYWORD", "REGEX"]),
    pattern: z.string().min(1).max(500),
    action: z.enum(["FLAG", "HIDE", "BLOCK"]),
  })
  .strict()
  // Une règle REGEX dont le motif ne compile pas ne matcherait jamais
  // (faux sentiment de couverture) — on la refuse à la création.
  .refine(
    (data) => {
      if (data.kind !== "REGEX") return true;
      try {
        new RegExp(data.pattern);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Motif d'expression régulière invalide.", path: ["pattern"] },
  );

export type ModerationRuleInput = z.infer<typeof moderationRuleSchema>;
