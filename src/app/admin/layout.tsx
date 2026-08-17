import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminAssistant } from "@/components/features/admin/admin-assistant";
import { AdminKeyboardShortcuts } from "@/components/features/admin/admin-keyboard-shortcuts";
import { AdminNotificationsBell } from "@/components/features/admin/admin-notifications-bell";
import { WorkspaceShell } from "@/components/features/workspace/workspace-shell";
import { isAdminAssistantConfigured } from "@/lib/ai/admin-assistant";
import { ADMIN_ROLES } from "@/lib/constants";
import { ADMIN_NAV } from "@/lib/workspace/admin-nav";
import { getAdminSidebarBadges } from "@/server/queries/admin-sidebar";

function isAdminRole(role: string): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/admin");
  if (!isAdminRole(session.user.role)) redirect("/");

  const badges = await getAdminSidebarBadges();

  // Sans clé Anthropic, le bouton d'assistant n'est pas rendu du tout — même
  // contrat que les autres fonctionnalités IA : absente plutôt que présente et
  // cassée.
  const assistantEnabled = isAdminAssistantConfigured();

  return (
    <WorkspaceShell
      navigation={ADMIN_NAV}
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        role: session.user.role,
      }}
      badges={badges}
      searchEndpoint="/api/admin/search"
      searchPlaceholder="Rechercher un écran, un apprenant, une formation…"
      settingsHref="/admin/parametres"
      extras={<AdminKeyboardShortcuts />}
      headerActions={
        <>
          {assistantEnabled ? <AdminAssistant /> : null}
          <AdminNotificationsBell badges={badges} />
        </>
      }
    >
      {children}
    </WorkspaceShell>
  );
}
