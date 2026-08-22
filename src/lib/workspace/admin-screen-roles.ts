// Rôles autorisés sur un écran d'administration, lus dans le registre de
// navigation.
//
// Une Server Action s'appelle directement, par son identifiant : restreindre
// un écran ne restreint pas ce qu'il déclenche. Une action qui garde son
// propre jeu de rôles finit donc par diverger de l'écran qu'elle sert — et
// c'est toujours dans le sens permissif, puisqu'on écrit `requireAnyAdminRole()`
// sans argument quand on ne veut pas trancher.
//
// En lisant `ADMIN_NAV`, la même déclaration que la garde de route de
// `auth.config.ts`, les deux ne peuvent plus s'écarter : changer les rôles
// d'une section change du même geste qui peut y entrer et qui peut y agir.

import type { AdminRole } from "@/lib/constants";
import { ADMIN_NAV } from "@/lib/workspace/admin-nav";
import { sectionRolesForPath } from "@/lib/workspace/navigation";

/**
 * Rôles admis sur l'écran désigné par `pathname`.
 *
 * Un chemin absent du registre renvoie une liste vide, que
 * `requireAnyAdminRole(...[])` interprète comme « tout rôle administratif » —
 * le comportement d'origine. On ne ferme jamais une porte par omission,
 * seulement sur déclaration.
 */
export function adminRolesForScreen(pathname: string): AdminRole[] {
  return [...(sectionRolesForPath(ADMIN_NAV, pathname) ?? [])] as AdminRole[];
}
