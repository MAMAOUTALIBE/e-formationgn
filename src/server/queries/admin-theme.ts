import "server-only";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ADMIN_TEXT_SCALE,
  isAdminTextScale,
  type AdminTextScale,
  type AdminThemeColors,
} from "@/lib/admin/theme";

/** Identifiant de la ligne unique — voir le modèle AdminUiTheme. */
export const ADMIN_THEME_ID = "singleton";

export interface AdminUiThemeSettings {
  colors: AdminThemeColors;
  textScale: AdminTextScale;
}

/**
 * Apparence de la coquille admin : couleurs et taille du texte.
 *
 * Lu à chaque rendu du layout admin, donc sur toutes les pages du CRM. La
 * requête porte sur une table à une seule ligne indexée par clé primaire :
 * le coût est négligeable. En cas d'erreur base, on renvoie l'apparence par
 * défaut plutôt que de faire tomber tout le back-office pour une question de
 * présentation.
 */
export async function getAdminUiTheme(): Promise<AdminUiThemeSettings> {
  const fallback: AdminUiThemeSettings = {
    colors: {},
    textScale: DEFAULT_ADMIN_TEXT_SCALE,
  };

  try {
    const row = await prisma.adminUiTheme.findUnique({
      where: { id: ADMIN_THEME_ID },
      select: {
        sidebarBg: true,
        headerBg: true,
        footerBg: true,
        textScale: true,
      },
    });
    if (!row) return fallback;

    return {
      colors: {
        sidebar: row.sidebarBg,
        header: row.headerBg,
        footer: row.footerBg,
      },
      // La colonne est un TEXT libre : une valeur obsolète ou saisie à la main
      // en base ne doit pas produire un `data-admin-text` sans règle CSS
      // correspondante, qui laisserait le CRM sans échelle du tout.
      textScale:
        row.textScale && isAdminTextScale(row.textScale)
          ? row.textScale
          : DEFAULT_ADMIN_TEXT_SCALE,
    };
  } catch {
    return fallback;
  }
}
