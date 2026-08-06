// Thème de la coquille du CRM admin : couleurs de la barre latérale, du
// header et du footer, réglables depuis /admin/parametres/branding.
//
// Principe : on ne stocke que la couleur de FOND choisie par l'admin. La
// couleur de texte est déduite de la luminance — sans ça, choisir un bleu
// marine pour la barre latérale rendrait le menu (texte gris foncé) illisible,
// et l'admin devrait régler six couleurs au lieu de trois.

/** Surfaces de la coquille admin dont le fond est réglable. */
export const ADMIN_THEME_SURFACES = ["sidebar", "header", "footer"] as const;
export type AdminThemeSurface = (typeof ADMIN_THEME_SURFACES)[number];

export type AdminThemeColors = Partial<Record<AdminThemeSurface, string | null>>;

/** Hex court (#abc) ou long (#aabbcc), casse indifférente. */
export const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

/** #abc → #aabbcc. Laisse les hex longs inchangés. */
function expandHex(hex: string): string {
  if (hex.length !== 4) return hex;
  const [, r, g, b] = hex;
  return `#${r}${r}${g}${g}${b}${b}`;
}

/**
 * Luminance relative (WCAG 2.x), 0 = noir, 1 = blanc.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(hex: string): number {
  const full = expandHex(hex);
  const channels = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Couleur de texte lisible sur un fond donné.
 *
 * Seuil à 0.5 plutôt qu'un calcul de ratio complet : sur les deux seuls
 * candidats (blanc et gris très foncé), le résultat est identique et reste
 * lisible sans dépendre d'une bibliothèque.
 */
export function readableTextOn(backgroundHex: string): string {
  return relativeLuminance(backgroundHex) > 0.5 ? "#0f172a" : "#ffffff";
}

/** Variante atténuée du texte, pour les libellés secondaires. */
export function mutedTextOn(backgroundHex: string): string {
  return relativeLuminance(backgroundHex) > 0.5
    ? "rgb(15 23 42 / 0.62)"
    : "rgb(255 255 255 / 0.68)";
}

/** Bordure discrète qui fonctionne sur fond clair comme sur fond sombre. */
export function borderOn(backgroundHex: string): string {
  return relativeLuminance(backgroundHex) > 0.5
    ? "rgb(15 23 42 / 0.12)"
    : "rgb(255 255 255 / 0.18)";
}

/** Fond de survol / d'état actif, lisible sur les deux extrêmes. */
export function hoverOn(backgroundHex: string): string {
  return relativeLuminance(backgroundHex) > 0.5
    ? "rgb(15 23 42 / 0.06)"
    : "rgb(255 255 255 / 0.12)";
}

/**
 * Traduit les couleurs choisies en variables CSS posées sur la coquille admin.
 *
 * Une surface non personnalisée n'émet AUCUNE variable : les composants
 * utilisent alors leur valeur de repli (`var(--admin-sidebar-bg, …)`) et donc
 * le thème par défaut, mode sombre inclus. C'est ce qui permet de « remettre
 * à zéro » une surface en vidant simplement son champ.
 */
export function adminThemeCssVars(colors: AdminThemeColors): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const surface of ADMIN_THEME_SURFACES) {
    const bg = colors[surface];
    if (!bg || !isHexColor(bg)) continue;
    vars[`--admin-${surface}-bg`] = bg;
    vars[`--admin-${surface}-fg`] = readableTextOn(bg);
    vars[`--admin-${surface}-muted`] = mutedTextOn(bg);
    vars[`--admin-${surface}-border`] = borderOn(bg);
    vars[`--admin-${surface}-hover`] = hoverOn(bg);
    // État actif du menu : le bleu marine de la charte disparaîtrait sur une
    // barre latérale sombre. On le remplace par un contraste calculé.
    vars[`--admin-${surface}-active-bg`] = hoverOn(bg);
    vars[`--admin-${surface}-active-fg`] = readableTextOn(bg);
  }

  return vars;
}
