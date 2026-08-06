import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Logo } from "@/components/branding/logo";
import { UserMenu } from "@/components/features/auth/user-menu";
import { AdminCommandMenu } from "@/components/features/admin/admin-command-menu";
import { AdminFooter } from "@/components/features/admin/admin-footer";
import { AdminKeyboardShortcuts } from "@/components/features/admin/admin-keyboard-shortcuts";
import { AdminMobileSidebar } from "@/components/features/admin/admin-mobile-sidebar";
import { AdminNotificationsBell } from "@/components/features/admin/admin-notifications-bell";
import { AdminSectionNav } from "@/components/features/admin/admin-section-nav";
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

  const badges = await getAdminSidebarBadges();

  return (
    // Coquille figée : la racine fait exactement la hauteur du viewport et ne
    // déborde jamais. `100dvh` (et non `100vh`) pour que la barre d'adresse
    // mobile n'ampute pas la vue. `minmax(0,1fr)` sur la rangée centrale est
    // indispensable : sans lui, un enfant de grille refuse de rétrécir sous la
    // taille de son contenu et déborderait malgré `overflow-hidden`.
    <div className="grid h-[100dvh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-muted/30">
      <AdminKeyboardShortcuts />
      {/* Liseré rouge d'identité : signale d'un coup d'œil qu'on est dans le
          back-office et non sur le site public, sans inonder la zone de
          travail — le rouge reste ainsi disponible pour signaler une alerte. */}
      <header className="z-30 border-t-[3px] border-t-[color:var(--brand-danger)] border-b border-b-border bg-background">
        <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <AdminMobileSidebar badges={badges} />
            <Link href="/" aria-label="Retour à l'accueil" className="hidden sm:block">
              <Logo width={140} priority />
            </Link>
            <span className="hidden rounded-md bg-[color:var(--brand-danger)]/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-danger)] lg:inline">
              CRM admin
            </span>
          </div>

          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="flex-1 max-w-md">
              <AdminCommandMenu />
            </div>
            <ThemeToggle className="hidden md:inline-flex" />
            <AdminNotificationsBell badges={badges} />
            <UserMenu
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

      {/* Rangée centrale : `min-h-0` autorise les deux colonnes à défiler
          indépendamment au lieu de pousser la grille au-delà du viewport. */}
      <div className="flex min-h-0 overflow-hidden">
        {/* Sidebar visible uniquement à partir de lg. Sur mobile/tablette,
            on utilise AdminMobileSidebar (drawer) déclenché depuis le header.
            `overflow-y-auto` : la navigation reste atteignable sur un écran
            court sans jamais faire défiler la coquille. */}
        <aside className="hidden overflow-y-auto overscroll-contain bg-background lg:block lg:w-60 lg:shrink-0 lg:border-r lg:border-border">
          <AdminSidebar badges={badges} />
        </aside>

        {/* Colonne de droite : la sous-navigation reste fixe, seul le contenu
            défile sous elle. */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AdminSectionNav />

          {/* Seule zone défilante de l'admin. `min-w-0` évite qu'un tableau
              large élargisse la colonne et déborde horizontalement. */}
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>

      <AdminFooter role={session.user.role} />
    </div>
  );
}
