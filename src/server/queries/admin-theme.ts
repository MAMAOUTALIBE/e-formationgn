import "server-only";

import { prisma } from "@/lib/prisma";
import type { AdminThemeColors } from "@/lib/admin/theme";

/** Identifiant de la ligne unique — voir le modèle AdminUiTheme. */
export const ADMIN_THEME_ID = "singleton";

/**
 * Couleurs de la coquille admin.
 *
 * Lu à chaque rendu du layout admin, donc sur toutes les pages du CRM. La
 * requête porte sur une table à une seule ligne indexée par clé primaire :
 * le coût est négligeable. En cas d'erreur base, on renvoie un thème vide
 * plutôt que de faire tomber tout le back-office pour une question de
 * couleur.
 */
export async function getAdminUiTheme(): Promise<AdminThemeColors> {
  try {
    const row = await prisma.adminUiTheme.findUnique({
      where: { id: ADMIN_THEME_ID },
      select: { sidebarBg: true, headerBg: true, footerBg: true },
    });
    if (!row) return {};
    return {
      sidebar: row.sidebarBg,
      header: row.headerBg,
      footer: row.footerBg,
    };
  } catch {
    return {};
  }
}
