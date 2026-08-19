import "server-only";

// Coquille commune aux espaces de travail (admin, formateur, élève).
//
// Elle porte TOUTE la mise en page — colonnes, thème, header, sous-navigation,
// pied de page — et rien du métier. Chaque espace lui passe sa navigation, ses
// compteurs et ses actions de header ; leurs `layout.tsx` se réduisent alors à
// une garde de rôle et un appel à ce composant.
//
// Composant serveur : il lit les cookies de préférences pour que le premier
// HTML sorte déjà dans le bon état (menu réduit, groupes repliés), sans saut
// après hydratation.

import { cookies } from "next/headers";
import Link from "next/link";

import { Logo } from "@/components/branding/logo";
import { UserMenu } from "@/components/features/auth/user-menu";
import { WorkspaceCommandMenu } from "@/components/features/workspace/workspace-command-menu";
import { WorkspaceFooter } from "@/components/features/workspace/workspace-footer";
import { WorkspaceMobileSidebar } from "@/components/features/workspace/workspace-mobile-sidebar";
import { WorkspaceSectionNav } from "@/components/features/workspace/workspace-section-nav";
import { WorkspaceSidebar } from "@/components/features/workspace/workspace-sidebar";
import type { WorkspaceBadges } from "@/components/features/workspace/workspace-nav";
import { ThemeToggle } from "@/components/features/theme/theme-toggle";
import { adminThemeCssVars } from "@/lib/admin/theme";
import {
  resolveWorkspaceNav,
  type WorkspaceNavigation,
} from "@/lib/workspace/navigation";
import {
  SIDEBAR_COLLAPSED_COOKIE,
  closedGroupsCookieName,
  parseClosedGroups,
} from "@/lib/workspace/preferences";
import { getAdminUiTheme } from "@/server/queries/admin-theme";

interface WorkspaceShellProps {
  navigation: WorkspaceNavigation;
  user: {
    name?: string | null;
    email: string;
    image?: string | null;
    role: string;
  };
  badges?: WorkspaceBadges;
  /** Point d'API de recherche métier de l'espace, s'il en a un. */
  searchEndpoint?: string;
  searchPlaceholder?: string;
  /** Lien « Paramètres » du pied de page. */
  settingsHref?: string;
  /** Actions propres à l'espace, insérées à gauche du sélecteur de thème. */
  headerActions?: React.ReactNode;
  /** Rendu tout en haut, hors flux — raccourcis clavier, écouteurs… */
  extras?: React.ReactNode;
  children: React.ReactNode;
}

export async function WorkspaceShell({
  navigation,
  user,
  badges = {},
  searchEndpoint,
  searchPlaceholder = "Rechercher un écran…",
  settingsHref,
  headerActions,
  extras,
  children,
}: WorkspaceShellProps) {
  const [theme, cookieStore] = await Promise.all([getAdminUiTheme(), cookies()]);

  // Un seul thème pour tous les espaces : le réglage de
  // /admin/parametres/branding vaut identité visuelle de l'application
  // connectée, pas seulement du back-office.
  const themeStyle = adminThemeCssVars(theme.colors) as React.CSSProperties;

  const nav = resolveWorkspaceNav(navigation, user.role);

  // Le repli du menu est partagé entre espaces ; les groupes repliés sont
  // propres à l'espace, leurs identifiants n'ayant pas de sens ailleurs.
  const collapsed = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value === "1";
  const closedGroups = parseClosedGroups(
    cookieStore.get(closedGroupsCookieName(navigation.id))?.value,
    navigation.groups.map((g) => g.id),
  );

  return (
    // Coquille figée : la racine fait exactement la hauteur du viewport et ne
    // déborde jamais. `100dvh` (et non `100vh`) pour que la barre d'adresse
    // mobile n'ampute pas la vue.
    //
    // Deux colonnes, et non une bande d'en-tête au-dessus de tout : la barre
    // latérale part du haut de l'écran et descend jusqu'en bas, header et
    // footer compris. C'est ce qui met le bloc logo au sommet et donne au menu
    // sa colonne pleine hauteur.
    //
    // Le liseré rouge d'identité est porté par la racine pour traverser toute
    // la largeur : il signale d'un coup d'œil qu'on est dans un espace de
    // travail et non sur le site public.
    //
    // `data-admin-text` redéfinit les variables de taille de Tailwind pour tout
    // le sous-arbre (blocs [data-admin-text=…] dans globals.css) : les `text-sm`
    // / `text-xs` suivent sans être touchés, et le site public garde son
    // échelle.
    <div
      style={themeStyle}
      data-admin-text={theme.textScale}
      className="workspace-shell flex h-[100dvh] min-h-[100dvh] min-w-0 shrink-0 overflow-hidden border-t-[3px] border-t-[color:var(--brand-danger)] bg-muted/30"
    >
      {extras}

      <WorkspaceSidebar
        nav={nav}
        badges={badges}
        defaultCollapsed={collapsed}
        defaultClosedGroups={closedGroups}
      />

      {/* Colonne de droite : header, sous-navigation et footer restent fixes,
          seul le contenu défile entre eux. `min-w-0` est indispensable — sans
          lui, un tableau large élargirait la colonne et déborderait de la
          coquille malgré `overflow-hidden`. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="workspace-header sticky top-0 z-40 shrink-0 border-b border-b-[color:var(--admin-header-border,var(--border))] bg-[color:var(--admin-header-bg,var(--background))] text-[color:var(--admin-header-fg,var(--foreground))]">
          {/* Grille en trois colonnes plutôt qu'un `flex` : la recherche reste
              centrée tant que l'espace le permet. À partir de `lg`, la colonne
              de droite garde toutefois au minimum la largeur réelle de ses
              commandes (`max-content`) : elle ne peut donc plus déborder sur
              le champ de recherche lorsque thème, notifications et identité
              utilisateur sont tous visibles. Les espacements renforcés sur
              desktop raccourcissent légèrement la recherche pour laisser une
              respiration nette avant les commandes d'affichage. */}
          <div className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,36rem)_minmax(max-content,1fr)] lg:gap-5 lg:px-6 xl:gap-6">
            {/* Sur ≥ lg le logo vit dans la barre latérale ; en dessous, elle
                est masquée et le logo revient ici, à côté du hamburger. */}
            <div className="flex min-w-0 items-center gap-2">
              <WorkspaceMobileSidebar
                nav={nav}
                badges={badges}
                defaultClosedGroups={closedGroups}
              />
              <Link
                href={navigation.homeHref}
                aria-label="Retour à l'accueil"
                className="hidden md:block lg:hidden"
              >
                <Logo width={120} priority />
              </Link>
            </div>

            <div className="min-w-0">
              <WorkspaceCommandMenu
                nav={nav}
                searchEndpoint={searchEndpoint}
                placeholder={searchPlaceholder}
              />
            </div>

            <div className="flex min-w-0 shrink-0 items-center gap-1 justify-self-end sm:gap-2 lg:gap-3">
              {headerActions}
              <ThemeToggle className="hidden md:inline-flex" />
              <UserMenu showIdentity user={user} />
            </div>
          </div>
        </header>

        <WorkspaceSectionNav nav={nav} />

        {/* Seule zone défilante de l'espace. */}
        <main className="workspace-main min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--brand-primary)_4%,transparent),transparent_24rem)]">
          <div className="workspace-content mx-auto min-w-0 w-full max-w-[2400px] px-[clamp(0.75rem,2vw,2.5rem)] py-[clamp(1rem,2vw,2rem)]">
            {children}
          </div>
        </main>

        <WorkspaceFooter
          label={navigation.label}
          role={user.role}
          settingsHref={settingsHref}
        />
      </div>
    </div>
  );
}
