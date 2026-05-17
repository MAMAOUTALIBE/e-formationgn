import "server-only";

import { flattenError, type ZodError, type ZodType } from "zod";

import type { ActionResult } from "@/server/actions/auth";

// Helper standard pour Server Actions à base de useActionState/formData :
// extrait toutes les entrées du FormData en strings, valide via le schéma
// Zod fourni, et renvoie soit `{ ok: true, data }`, soit un ActionResult
// `{ success: false, fieldErrors, message }` prêt à être retourné tel quel.
//
// Évite la duplication du pattern :
//   const parsed = schema.safeParse({ ... });
//   if (!parsed.success) {
//     return { success: false, fieldErrors: parsed.error.flatten().fieldErrors,
//              message: "Veuillez corriger les erreurs ci-dessous." };
//   }
//
// Usage :
//   const parsed = validateFormData(formData, mySchema);
//   if (!parsed.ok) return parsed.error;
//   const data = parsed.data;
//
// Le paramètre `picks` (optionnel) permet de choisir précisément quels noms
// de champs lire dans le FormData (utile quand certains champs sont multivalués
// via formData.getAll). Sinon on lit toutes les entrées avec formData.entries().

type FieldErrors = Record<string, string[] | undefined>;

export type ValidatedActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { success: false; fieldErrors: FieldErrors; message: string } };

// Le schéma peut être n'importe quel ZodType ; on type T = ZodType<infer U>
// pour récupérer le type de sortie sans recourir à des params génériques
// internes à Zod (changements d'API entre v3 et v4).
export function validateFormData<S extends ZodType>(
  formData: FormData,
  schema: S,
  options: {
    // Custom message si la validation échoue.
    message?: string;
    // Transformation préalable du payload (ex : ajouter des valeurs déduites
    // côté serveur avant validation).
    preprocess?: (raw: Record<string, FormDataEntryValue | FormDataEntryValue[]>) => unknown;
  } = {},
): ValidatedActionResult<S extends ZodType<infer U> ? U : never> {
  // Convertit FormData → plain object. Si un nom apparaît plusieurs fois,
  // on regroupe ses valeurs en array.
  const raw: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const [key, value] of formData.entries()) {
    const existing = raw[key];
    if (existing === undefined) {
      raw[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      raw[key] = [existing, value];
    }
  }

  const payload = options.preprocess ? options.preprocess(raw) : raw;
  const parsed = schema.safeParse(payload);
  if (parsed.success) {
    return { ok: true, data: parsed.data as S extends ZodType<infer U> ? U : never };
  }

  return {
    ok: false,
    error: {
      success: false,
      fieldErrors: flattenZodFieldErrors(parsed.error),
      message: options.message ?? "Veuillez corriger les erreurs ci-dessous.",
    },
  };
}

function flattenZodFieldErrors(error: ZodError): FieldErrors {
  // Zod v4 expose flattenError(error) au top-level (préférer à error.flatten()
  // qui n'existe plus). Le résultat a la même forme `{ formErrors, fieldErrors }`.
  // On caste vers FieldErrors (compatible avec ActionResult).
  return flattenError(error).fieldErrors as FieldErrors;
}

// Type guard : permet aux callers de réutiliser ActionResult{success:false} typed.
export function isActionError<T>(
  result: ValidatedActionResult<T>,
): result is { ok: false; error: ActionResult & { success: false; fieldErrors: FieldErrors; message: string } } {
  return !result.ok;
}
