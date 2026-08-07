// Préférences de la barre latérale du CRM : menu réduit et groupes repliés.
//
// Pourquoi des cookies et pas `localStorage` : la barre latérale est rendue
// par le serveur. Avec `localStorage`, le premier rendu afficherait toujours
// le menu déplié, puis il se replierait après hydratation — un saut visible à
// chaque navigation. Le cookie est lu dans le layout, donc le premier HTML est
// déjà dans le bon état.
//
// Fichier pur (aucun import `next/headers`) : il est consommé par le layout
// serveur ET par les composants client qui écrivent le cookie.

import { ADMIN_NAV_GROUPS, type AdminNavGroupId } from "@/lib/admin/navigation";

export const SIDEBAR_COLLAPSED_COOKIE = "admin_sidebar_collapsed";
export const SIDEBAR_CLOSED_GROUPS_COOKIE = "admin_nav_closed";

/** Une préférence d'affichage n'a pas de raison d'expirer avant un an. */
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const GROUP_IDS = new Set<string>(ADMIN_NAV_GROUPS.map((g) => g.id));

function isGroupId(value: string): value is AdminNavGroupId {
  return GROUP_IDS.has(value);
}

/**
 * `"pilotage,catalogue"` → `["pilotage", "catalogue"]`.
 *
 * Les identifiants inconnus sont ignorés : un groupe supprimé du registre ne
 * doit pas faire échouer la lecture d'un cookie posé par une version
 * antérieure.
 */
export function parseClosedGroups(value: string | undefined): AdminNavGroupId[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim()).filter(isGroupId);
}

export function serializeClosedGroups(ids: readonly AdminNavGroupId[]): string {
  return ids.join(",");
}

/** Écrit une préférence côté client. No-op pendant le rendu serveur. */
export function persistSidebarCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax`;
}
