"use server";

// Server Action : apparence de la coquille du CRM admin — couleurs de la barre
// latérale, du header et du footer, et taille du texte. Réglée depuis
// /admin/parametres/branding.

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/authorization";
import {
  ADMIN_TEXT_SCALES,
  DEFAULT_ADMIN_TEXT_SCALE,
  HEX_COLOR_PATTERN,
} from "@/lib/admin/theme";
import { prisma } from "@/lib/prisma";
import { ADMIN_THEME_ID } from "@/server/queries/admin-theme";
import { createAuditLog } from "@/server/services/audit-log";

import type { ActionResult } from "./auth";

/**
 * Un champ vide vaut « revenir à la couleur par défaut » : on le normalise en
 * null plutôt que d'enregistrer une chaîne vide, que la couche d'affichage
 * devrait ensuite traiter comme un cas particulier.
 *
 * La validation du format hexadécimal n'est pas cosmétique : la valeur est
 * injectée dans une variable CSS côté rendu. Un `.strict()` sur le schéma et
 * un motif fermé garantissent qu'aucune autre syntaxe (url(), expression,
 * point-virgule) ne peut atteindre la feuille de style.
 */
const optionalHex = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .refine((v) => v === null || HEX_COLOR_PATTERN.test(v), {
    message: "Couleur invalide : utilisez un format hexadécimal, par exemple #1E3A8A.",
  });

const themeSchema = z
  .object({
    sidebarBg: optionalHex,
    headerBg: optionalHex,
    footerBg: optionalHex,
    // Enum fermé plutôt que chaîne libre : la valeur devient un attribut
    // `data-admin-text` dont dépend le choix de la règle CSS. Une valeur
    // inconnue laisserait la coquille sans échelle typographique.
    textScale: z.enum(ADMIN_TEXT_SCALES),
  })
  .strict();

export async function updateAdminUiTheme(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { success: false, message: "Non autorisé." };
  }

  const parsed = themeSchema.safeParse({
    sidebarBg: formData.get("sidebarBg") ?? "",
    headerBg: formData.get("headerBg") ?? "",
    footerBg: formData.get("footerBg") ?? "",
    textScale: formData.get("textScale") ?? DEFAULT_ADMIN_TEXT_SCALE,
  });

  if (!parsed.success) {
    return {
      success: false,
      message: "Réglage invalide.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = {
    ...parsed.data,
    updatedBy: session.userId,
  };

  await prisma.adminUiTheme.upsert({
    where: { id: ADMIN_THEME_ID },
    create: { id: ADMIN_THEME_ID, ...data },
    update: data,
  });

  await createAuditLog({
    actorId: session.userId,
    action: "admin.theme.update",
    targetType: "AdminUiTheme",
    targetId: ADMIN_THEME_ID,
    metadata: parsed.data,
  });

  // Le layout admin lit le thème : toutes les pages du CRM doivent être
  // revalidées, pas seulement l'écran de réglage.
  revalidatePath("/admin", "layout");

  return { success: true, message: "Apparence enregistrée." };
}
