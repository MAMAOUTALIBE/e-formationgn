"use client";

// Décide OÙ le widget Aiduca-IA apparaît, et avec quel contexte.
//
// Monté une seule fois dans le layout racine plutôt que page par page : une
// vingtaine de pages publiques rendent `SiteFooter`, et les oublier une à une
// est le moyen le plus sûr de livrer un assistant absent de la moitié du site.
//
// Exclusions, chacune pour une raison différente :
//  - /admin et /formateur ont déjà leur propre assistant d'exploitation ;
//  - /contact possède son parcours Aiduca-IA intégré ;
//  - l'atelier de leçon a le tuteur pédagogique, ancré sur la leçon en cours ;
//  - les écrans d'authentification doivent rester sans distraction.

import { usePathname } from "next/navigation";

import { AiducaAssistant } from "@/components/features/assistant/aiduca-assistant";

const HIDDEN_PREFIXES = [
  "/admin",
  "/formateur",
  "/contact",
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/reinitialiser-mot-de-passe",
  "/changer-mot-de-passe",
];

/** L'atelier de leçon : /apprentissage/<slug>/lecons/<id>. */
const LESSON_WORKSPACE = /^\/apprentissage\/[^/]+\/lecons\//;

/** La fiche formation : /cours/<slug> (mais pas /cours seul). */
const COURSE_PAGE = /^\/cours\/([a-z0-9-]+)(?:\/|$)/;

export function AssistantMount() {
  const pathname = usePathname();
  if (!pathname) return null;

  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  if (LESSON_WORKSPACE.test(pathname)) return null;

  // Sur une fiche formation, la question porte presque toujours sur ELLE :
  // le slug est transmis pour que la fiche soit systématiquement dans le
  // contexte, même si la recherche plein-texte ne la remonte pas.
  const courseSlug = COURSE_PAGE.exec(pathname)?.[1] ?? null;

  return <AiducaAssistant courseSlug={courseSlug} />;
}
