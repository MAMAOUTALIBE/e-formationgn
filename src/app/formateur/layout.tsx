import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { WorkspaceShell } from "@/components/features/workspace/workspace-shell";
import { INSTRUCTOR_NAV } from "@/lib/workspace/instructor-nav";
import { getInstructorSidebarBadges } from "@/server/queries/instructor-sidebar";

export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion?callbackUrl=/formateur");
  }
  // Un ADMIN garde l'accès : il doit pouvoir constater ce que voit un
  // formateur sans changer de compte.
  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    redirect("/devenir-formateur");
  }

  const badges = await getInstructorSidebarBadges(session.user.id);

  return (
    <WorkspaceShell
      navigation={INSTRUCTOR_NAV}
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        role: session.user.role,
      }}
      badges={badges}
      // Pas de `searchEndpoint` : l'espace formateur n'a pas d'index métier.
      // Le ⌘K y reste une navigation rapide entre ses écrans.
      searchPlaceholder="Rechercher un écran de l'espace formateur…"
    >
      {children}
    </WorkspaceShell>
  );
}
