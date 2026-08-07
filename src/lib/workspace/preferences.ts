// Préférences d'affichage de la barre latérale : menu réduit et groupes
// repliés.
//
// Pourquoi des cookies et pas `localStorage` : la barre latérale est rendue
// par le serveur. Avec `localStorage`, le premier rendu afficherait toujours
// le menu déplié, puis il se replierait après hydratation — un saut visible à
// chaque navigation. Le cookie est lu dans le layout, donc le premier HTML est
// déjà dans le bon état.
//
// Portée : le repli du menu est PARTAGÉ entre les espaces (celui qui préfère
// un menu compact le veut partout), tandis que les groupes repliés sont
// PROPRES à chaque espace — leurs identifiants n'ont rien à voir d'un espace à
// l'autre (« pilotage » côté admin, « enseignement » côté formateur).
//
// Fichier pur (aucun import `next/headers`) : consommé par les layouts serveur
// ET par les composants client qui écrivent le cookie.

export const SIDEBAR_COLLAPSED_COOKIE = "crm_sidebar_collapsed";

/** Une préférence d'affichage n'a pas de raison d'expirer avant un an. */
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function closedGroupsCookieName(workspaceId: string): string {
  return `crm_nav_closed_${workspaceId}`;
}

/**
 * `"pilotage,catalogue"` → `["pilotage", "catalogue"]`.
 *
 * Les identifiants inconnus de l'espace sont ignorés : un groupe supprimé du
 * registre ne doit pas faire échouer la lecture d'un cookie posé par une
 * version antérieure.
 */
export function parseClosedGroups(
  value: string | undefined,
  knownGroupIds: readonly string[],
): string[] {
  if (!value) return [];
  const known = new Set(knownGroupIds);
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => known.has(s));
}

export function serializeClosedGroups(ids: readonly string[]): string {
  return ids.join(",");
}

/** Écrit une préférence côté client. No-op pendant le rendu serveur. */
export function persistSidebarCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax`;
}
