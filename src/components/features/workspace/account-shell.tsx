import "server-only";

// Coquille des écrans de compte, partagés par tous les rôles : profil, liste
// d'envies, notifications, apprentissage.
//
// Ces pages n'appartiennent à aucun espace en particulier — un formateur et un
// administrateur consultent le même profil qu'un élève. Leur imposer le menu
// « élève » serait faux. On monte donc la coquille avec la navigation du rôle
// de CELUI QUI REGARDE : chacun garde son menu et retrouve son espace d'un
// clic depuis n'importe quel écran de compte.

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { WorkspaceShell } from "@/components/features/workspace/workspace-shell";
import { ADMIN_ROLES } from "@/lib/constants";
import { ADMIN_NAV } from "@/lib/workspace/admin-nav";
import { INSTRUCTOR_NAV } from "@/lib/workspace/instructor-nav";
import { STUDENT_NAV } from "@/lib/workspace/student-nav";
import type { WorkspaceNavigation } from "@/lib/workspace/navigation";

/** Navigation à monter pour un rôle donné. */
export function navigationForRole(role: string): WorkspaceNavigation {
  if ((ADMIN_ROLES as readonly string[]).includes(role)) return ADMIN_NAV;
  if (role === "INSTRUCTOR") return INSTRUCTOR_NAV;
  return STUDENT_NAV;
}

export async function AccountShell({
  children,
  callbackUrl,
  contentClassName,
}: {
  children: React.ReactNode;
  /** Route à rejoindre après connexion si la session manque. */
  callbackUrl: string;
  /** Permet aux écrans riches, comme l'apprentissage, d'utiliser un grand moniteur. */
  contentClassName?: string;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/connexion?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return (
    <WorkspaceShell
      navigation={navigationForRole(session.user.role)}
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        role: session.user.role,
      }}
      searchPlaceholder="Rechercher un écran…"
      contentClassName={contentClassName}
    >
      {children}
    </WorkspaceShell>
  );
}
