// Socle de navigation partagé par les espaces de travail (admin, formateur,
// élève).
//
// Chaque espace décrit ses écrans dans un registre — et rien d'autre. Le
// registre est ensuite consommé, à l'identique pour tous, par la barre
// latérale, le drawer mobile, la sous-navigation de section et le ⌘K.
// Ajouter un écran à un registre le rend simultanément navigable et
// recherchable dans son espace, sans toucher à un seul composant.
//
// C'est aussi ici que vit la restriction d'accès *à l'affichage* : une entrée
// peut déclarer les rôles qui la voient. Ce filtrage est cosmétique et ne
// remplace jamais les gardes serveur — `authConfig.callbacks.authorized` et les
// helpers de src/lib/auth/authorization.ts restent la seule autorité.

/**
 * Icône d'une section, désignée par un nom et non par un composant : ce
 * fichier est importé par du code client ET serveur, et un `.ts` ne peut pas
 * porter de JSX. La correspondance nom → composant vit dans <WorkspaceNav>.
 */
export type WorkspaceIconName =
  | "gauge"
  | "chart"
  | "wallet"
  | "megaphone"
  | "users"
  | "graduation"
  | "lifebuoy"
  | "book"
  | "alert"
  | "settings"
  | "shield"
  | "calendar"
  | "star"
  | "tag"
  | "link"
  | "help"
  | "certificate"
  | "heart"
  | "bell"
  | "play"
  | "video"
  | "building";

export interface WorkspaceNavItem {
  href: string;
  label: string;
}

export interface WorkspaceNavGroup {
  id: string;
  label: string;
}

export interface WorkspaceSection extends WorkspaceNavItem {
  /** Sous-pages, toutes préfixées par `href` (la résolution est par préfixe). */
  children: WorkspaceNavItem[];
  icon: WorkspaceIconName;
  /** Absent = section épinglée hors groupe, en tête de menu. */
  group?: string;
  /** Compteurs additionnés dans la pastille de la section. */
  badgeKeys?: string[];
  /**
   * Rôles qui voient cette entrée. Absent = visible par tous ceux qui ont déjà
   * franchi la garde de l'espace.
   */
  roles?: readonly string[];
}

/** Tout ce dont la coquille a besoin pour afficher la navigation d'un espace. */
export interface WorkspaceNavigation {
  /** Identifiant court de l'espace — sert à nommer les cookies de préférences. */
  id: string;
  /** Libellé affiché dans le pied de page (« CRM admin », « Espace formateur »). */
  label: string;
  /** Destination du bloc logo en haut de la barre latérale. */
  homeHref: string;
  groups: readonly WorkspaceNavGroup[];
  sections: readonly WorkspaceSection[];
  /**
   * Écrans hors arborescence des sections : ils existent, sont liés depuis
   * ailleurs, mais n'appartiennent à aucun préfixe. Listés pour rester
   * joignables au ⌘K.
   */
  standalonePages?: readonly WorkspaceNavItem[];
}

/** Une section est-elle visible pour ce rôle ? */
export function isSectionVisible(section: WorkspaceSection, role: string): boolean {
  return !section.roles || section.roles.includes(role);
}

/**
 * Vue de la navigation prête à afficher, déjà filtrée pour un rôle donné.
 *
 * Le filtrage est fait ici, une fois, plutôt que dans chaque composant : sinon
 * la barre latérale, le drawer et le ⌘K pourraient diverger et proposer un
 * écran que le menu masque.
 */
export interface ResolvedWorkspaceNav {
  id: string;
  label: string;
  homeHref: string;
  /** Sections hors groupe, épinglées en tête. */
  pinned: WorkspaceSection[];
  /** Groupes non vides, dans l'ordre déclaré. */
  groups: Array<{ id: string; label: string; sections: WorkspaceSection[] }>;
  /** Tous les écrans à plat — alimente la recherche du ⌘K. */
  pages: WorkspaceNavItem[];
}

export function resolveWorkspaceNav(
  nav: WorkspaceNavigation,
  role: string,
): ResolvedWorkspaceNav {
  const visible = nav.sections.filter((s) => isSectionVisible(s, role));

  return {
    id: nav.id,
    label: nav.label,
    homeHref: nav.homeHref,
    pinned: visible.filter((s) => !s.group),
    // Un groupe vide est omis : on n'affiche jamais un en-tête qui ne coifferait
    // aucun lien — cas courant dès qu'un rôle n'a accès qu'à une partie.
    groups: nav.groups
      .map((g) => ({
        id: g.id,
        label: g.label,
        sections: visible.filter((s) => s.group === g.id),
      }))
      .filter((g) => g.sections.length > 0),
    pages: [
      ...visible.flatMap((s) => [
        { href: s.href, label: s.label },
        ...s.children,
      ]),
      ...(nav.standalonePages ?? []),
    ],
  };
}

/**
 * Section active pour un pathname donné.
 *
 * On retient le préfixe le PLUS LONG qui correspond : sans ça, la racine de
 * l'espace (qui préfixe tout) gagnerait systématiquement. Elle n'est donc
 * renvoyée que pour une correspondance exacte.
 */
export function findWorkspaceSection(
  sections: readonly WorkspaceSection[],
  pathname: string,
): WorkspaceSection | null {
  let best: WorkspaceSection | null = null;
  for (const section of sections) {
    const matches =
      pathname === section.href || pathname.startsWith(`${section.href}/`);
    if (matches && (!best || section.href.length > best.href.length)) {
      best = section;
    }
  }
  return best;
}

/**
 * Rôles autorisés sur un chemin, d'après le registre de l'espace.
 *
 * C'est ce qui empêche le menu et la garde de route de diverger : les deux
 * lisent la même déclaration. Sans ça, masquer une section dans le menu ne
 * ferait que la rendre discrète — elle resterait atteignable en tapant l'URL.
 *
 * Renvoie `null` quand le chemin n'est couvert par aucune section — écrans
 * hors arborescence, routes ajoutées sans passer par le registre. Dans ce cas
 * l'appelant garde son comportement d'origine : on ne ferme jamais une porte
 * par omission, seulement sur déclaration explicite.
 */
export function sectionRolesForPath(
  nav: WorkspaceNavigation,
  pathname: string,
): readonly string[] | null {
  const section = findWorkspaceSection(nav.sections, pathname);
  return section?.roles ?? null;
}

/** Une entrée est-elle la page courante ? */
export function isNavItemActive(href: string, pathname: string, rootHref: string): boolean {
  // La racine de l'espace ne matche qu'exactement, sinon elle resterait active
  // sur toutes ses sous-pages en même temps que la section réellement ouverte.
  if (href === rootHref) return pathname === rootHref;
  return pathname === href || pathname.startsWith(`${href}/`);
}
