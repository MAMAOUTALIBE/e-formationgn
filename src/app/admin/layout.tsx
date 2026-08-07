import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Logo } from "@/components/branding/logo";
import { UserMenu } from "@/components/features/auth/user-menu";
import { AdminAssistant } from "@/components/features/admin/admin-assistant";
import { AdminCommandMenu } from "@/components/features/admin/admin-command-menu";
import { AdminFooter } from "@/components/features/admin/admin-footer";
import { AdminKeyboardShortcuts } from "@/components/features/admin/admin-keyboard-shortcuts";
import { AdminMobileSidebar } from "@/components/features/admin/admin-mobile-sidebar";
import { AdminNotificationsBell } from "@/components/features/admin/admin-notifications-bell";
import { AdminSectionNav } from "@/components/features/admin/admin-section-nav";
import { isAdminAssistantConfigured } from "@/lib/ai/admin-assistant";
import { adminThemeCssVars } from "@/lib/admin/theme";
import {
  SIDEBAR_CLOSED_GROUPS_COOKIE,
  SIDEBAR_COLLAPSED_COOKIE,
  parseClosedGroups,
} from "@/lib/admin/sidebar-preferences";
import { getAdminUiTheme } from "@/server/queries/admin-theme";
import { AdminSidebar } from "@/components/features/admin/admin-sidebar";
import { ThemeToggle } from "@/components/features/theme/theme-toggle";
import { getAdminSidebarBadges } from "@/server/queries/admin-sidebar";

const ADMIN_ROLES = ["ADMIN", "MODERATOR", "SUPPORT", "FINANCE"] as const;
type AdminRole = (typeof ADMIN_ROLES)[number];

function isAdminRole(role: string): role is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/admin");
  if (!isAdminRole(session.user.role)) redirect("/");

  const [badges, theme, cookieStore] = await Promise.all([
    getAdminSidebarBadges(),
    getAdminUiTheme(),
    cookies(),
  ]);

  // Préférences de menu lues côté serveur : le premier HTML sort déjà dans le
  // bon état, sans repli visible après hydratation.
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE)?.value === "1";
  const closedGroups = parseClosedGroups(
    cookieStore.get(SIDEBAR_CLOSED_GROUPS_COOKIE)?.value,
  );

  // Pas de clé Anthropic → pas de bouton. Même contrat que les autres
  // fonctionnalités IA : absente plutôt que présente et cassée.
  const assistantEnabled = isAdminAssistantConfigured();

  // Les couleurs choisies deviennent des variables CSS posées sur la coquille.
  // Une surface non personnalisée n'émet aucune variable : les composants
  // retombent sur leur valeur de repli, donc sur le thème par défaut (mode
  // sombre compris).
  const themeStyle = adminThemeCssVars(theme.colors) as React.CSSProperties;

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
    // la largeur : il signale d'un coup d'œil qu'on est dans le back-office et
    // non sur le site public, sans inonder la zone de travail — le rouge reste
    // ainsi disponible pour signaler une alerte.
    //
    // `data-admin-text` redéfinit les variables de taille de Tailwind pour
    // tout le sous-arbre (blocs [data-admin-text=…] dans globals.css) : les
    // ~400 `text-sm` / `text-xs` du CRM suivent sans être touchés, et le site
    // public garde son échelle.
    <div
      style={themeStyle}
      data-admin-text={theme.textScale}
      className="flex h-[100dvh] overflow-hidden border-t-[3px] border-t-[color:var(--brand-danger)] bg-muted/30"
    >
      <AdminKeyboardShortcuts />

      {/* Sidebar visible uniquement à partir de lg. Sur mobile/tablette, on
          utilise AdminMobileSidebar (drawer) déclenché depuis le header. Elle
          rend son propre <aside> : c'est elle qui pilote sa largeur (menu
          complet ou rail d'icônes). */}
      <AdminSidebar
        badges={badges}
        defaultCollapsed={sidebarCollapsed}
        defaultClosedGroups={closedGroups}
      />

      {/* Colonne de droite : header, sous-navigation et footer restent fixes,
          seul le contenu défile entre eux. `min-w-0` est indispensable — sans
          lui, un tableau large élargirait la colonne et déborderait de la
          coquille malgré `overflow-hidden`. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-30 shrink-0 border-b border-b-[color:var(--admin-header-border,var(--border))] bg-[color:var(--admin-header-bg,var(--background))] text-[color:var(--admin-header-fg,var(--foreground))]">
          {/* Grille en trois colonnes plutôt qu'un `flex` : les deux colonnes
              latérales font `1fr` chacune, donc la recherche reste centrée sur
              la zone de travail même si le bloc d'actions à droite est bien
              plus large que le bloc de gauche. En `flex`, elle se collait à
              gauche. La colonne centrale est bornée pour ne pas s'étirer sur
              les très grands écrans. */}
          <div className="grid h-16 grid-cols-[1fr_minmax(0,36rem)_1fr] items-center gap-3 px-4 lg:px-6">
            {/* Sur ≥ lg le logo vit dans la barre latérale ; en dessous, elle
                est masquée et le logo revient ici, à côté du hamburger. */}
            <div className="flex min-w-0 items-center gap-2">
              <AdminMobileSidebar badges={badges} defaultClosedGroups={closedGroups} />
              <Link
                href="/"
                aria-label="Retour à l'accueil"
                className="hidden sm:block lg:hidden"
              >
                <Logo width={120} priority />
              </Link>
            </div>

            <div className="min-w-0">
              <AdminCommandMenu />
            </div>

            <div className="flex shrink-0 items-center gap-2 justify-self-end">
              {assistantEnabled ? <AdminAssistant /> : null}
              <ThemeToggle className="hidden md:inline-flex" />
              <AdminNotificationsBell badges={badges} />
              <UserMenu
                showIdentity
                user={{
                  name: session.user.name,
                  email: session.user.email,
                  image: session.user.image,
                  role: session.user.role,
                }}
              />
            </div>
          </div>
        </header>

        <AdminSectionNav />

        {/* Seule zone défilante de l'admin. */}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>

        <AdminFooter role={session.user.role} />
      </div>
    </div>
  );
}
