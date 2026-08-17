// Registre de navigation de l'espace formateur.
//
// Pas de champ `roles` ici : la garde de l'espace (INSTRUCTOR ou ADMIN) est
// posée dans le layout, et une fois franchie tous les écrans concernent le
// même métier. La restriction utile pour un formateur n'est pas par rôle mais
// par propriété — il ne voit que SES cours — et elle est déjà appliquée en
// base par `requireCourseOwnership` et les requêtes de src/server/queries.

import type { WorkspaceNavigation } from "@/lib/workspace/navigation";

export const INSTRUCTOR_NAV: WorkspaceNavigation = {
  id: "formateur",
  label: "Espace formateur",
  homeHref: "/",
  groups: [
    { id: "enseignement", label: "Enseignement" },
    { id: "audience", label: "Audience" },
  ],
  sections: [
    {
      href: "/formateur",
      label: "Tableau de bord",
      icon: "gauge",
      children: [],
    },
    {
      href: "/formateur/cours",
      label: "Mes cours",
      icon: "book",
      group: "enseignement",
      children: [{ href: "/formateur/cours/nouveau", label: "Créer un cours" }],
    },
    {
      href: "/formateur/questions",
      label: "Questions & réponses",
      icon: "help",
      group: "audience",
      badgeKeys: ["pendingQuestions"],
      children: [],
    },
    {
      href: "/formateur/avis",
      label: "Avis",
      icon: "star",
      group: "audience",
      children: [],
    },
  ],
};
