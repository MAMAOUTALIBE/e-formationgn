// Registre de navigation de l'espace élève.
//
// Pas de champ `roles` : la restriction qui compte ici n'est pas le rôle mais
// l'inscription — un élève ne voit que les cours auxquels il est inscrit, ce
// que les requêtes de src/server/queries appliquent déjà en base.
//
// Les vues de /apprentissage (« En cours », « Terminés », « Liste d'envies »)
// ne figurent PAS comme sections : ce sont des paramètres d'URL (`?filter=`)
// et non des routes. Les déclarer ici les allumerait toutes en même temps,
// l'état actif se calculant sur le chemin. Elles restent donc gérées par les
// onglets de la page.

import type { WorkspaceNavigation } from "@/lib/workspace/navigation";

export const STUDENT_NAV: WorkspaceNavigation = {
  id: "eleve",
  label: "Mon espace",
  homeHref: "/",
  groups: [{ id: "compte", label: "Mon compte" }],
  sections: [
    {
      href: "/apprentissage",
      label: "Mon apprentissage",
      icon: "play",
      children: [],
    },
    {
      href: "/classes-virtuelles",
      label: "Classes virtuelles",
      icon: "video",
      children: [],
    },
    {
      href: "/wishlist",
      label: "Liste d'envies",
      icon: "heart",
      group: "compte",
      children: [],
    },
    {
      href: "/notifications",
      label: "Notifications",
      icon: "bell",
      group: "compte",
      children: [],
    },
    {
      href: "/profil",
      label: "Mon profil",
      icon: "users",
      group: "compte",
      children: [],
    },
  ],
};
