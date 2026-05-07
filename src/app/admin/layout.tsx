import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Logo } from "@/components/branding/logo";
import { UserMenu } from "@/components/features/auth/user-menu";
import { AdminCommandMenu } from "@/components/features/admin/admin-command-menu";
import { AdminSidebar } from "@/components/features/admin/admin-sidebar";
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
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Retour à l'accueil" className="hidden sm:block">
              <Logo width={140} priority />
            </Link>
            <span className="hidden rounded-md bg-[color:var(--brand-primary)]/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-primary)] lg:inline">
              CRM admin
            </span>
          </div>

          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="flex-1 max-w-md">
              <AdminCommandMenu />
            </div>
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

      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="border-b border-border bg-background lg:w-60 lg:border-b-0 lg:border-r">
          <AdminSidebar badges={badges} />
        </aside>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
