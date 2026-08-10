// Préférences d'apparence indépendantes par grande surface du produit.
//
// La portée dépend volontairement de la route et non du rôle : un admin peut
// ouvrir l'espace formateur pour le contrôler sans que son thème CRM y soit
// appliqué. Les pages de compte et d'apprentissage appartiennent à la portée
// élève, tandis que le catalogue, l'authentification et les pages marketing
// restent dans la portée publique.

export const THEME_SCOPES = ["public", "admin", "formateur", "eleve"] as const;

export type ThemeScope = (typeof THEME_SCOPES)[number];

const STUDENT_ACCOUNT_ROOTS = [
  "/apprentissage",
  "/wishlist",
  "/notifications",
  "/profil",
] as const;

function isWithin(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

export function resolveThemeScope(pathname: string): ThemeScope {
  if (isWithin(pathname, "/admin")) return "admin";
  if (isWithin(pathname, "/formateur")) return "formateur";
  if (STUDENT_ACCOUNT_ROOTS.some((root) => isWithin(pathname, root))) return "eleve";
  return "public";
}

export function themeStorageKey(scope: ThemeScope): string {
  return `gandal-theme-${scope}`;
}
