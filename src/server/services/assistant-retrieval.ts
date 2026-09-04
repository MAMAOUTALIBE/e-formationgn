import "server-only";

// Assemblage du contexte transmis à Aiduca-IA.
//
// La récupération est DÉTERMINISTE et se fait avant tout appel au modèle :
// on cherche en base, on met en forme, puis on demande au modèle de choisir
// parmi ce qu'on lui a donné. Le modèle n'a aucun outil, aucune requête, aucun
// accès à la base — il ne peut donc pas aller chercher ce qu'on ne lui a pas
// montré.

import { BRAND } from "@/lib/brand";
import type { AssistantContext } from "@/lib/assistant/contract";
import {
  retrieveCourseBySlug,
  retrieveCourses,
  retrieveDocuments,
  retrieveDocumentsByCategory,
  retrieveUpcomingSessions,
} from "@/server/queries/assistant";

/**
 * Catégorie de documents toujours jointe au contexte.
 *
 * Sans ce filet, une question mal formulée ne remonte rien en plein-texte et
 * l'assistant répond « je ne sais pas » alors que la marche à suivre pour
 * s'inscrire est écrite noir sur blanc dans la base documentaire.
 */
export const ESSENTIALS_CATEGORY = "Essentiels";

export interface BuildContextOptions {
  /** Fiche de la page consultée, quand la question part d'une page cours. */
  courseSlug?: string | null;
  /** Vrai si la question ressemble à une demande de calendrier. */
  includeSchedule?: boolean;
}

const SCHEDULE_HINTS = [
  "date",
  "dates",
  "calendrier",
  "session",
  "sessions",
  "prochaine",
  "prochaines",
  "quand",
  "planning",
  "rentrée",
  "démarre",
  "commence",
];

/** Vrai si la question porte vraisemblablement sur le calendrier. */
export function looksLikeScheduleQuestion(question: string): boolean {
  const normalized = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return SCHEDULE_HINTS.some((hint) => {
    const plain = hint.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return new RegExp(`\\b${plain}\\b`).test(normalized);
  });
}

export async function buildAssistantContext(
  question: string,
  options: BuildContextOptions = {},
): Promise<AssistantContext> {
  const wantsSchedule = options.includeSchedule ?? looksLikeScheduleQuestion(question);

  const [matchedCourses, matchedDocuments, essentials, pinnedCourse, sessions] =
    await Promise.all([
      retrieveCourses(question),
      retrieveDocuments(question),
      retrieveDocumentsByCategory(ESSENTIALS_CATEGORY),
      options.courseSlug ? retrieveCourseBySlug(options.courseSlug) : null,
      wantsSchedule ? retrieveUpcomingSessions() : [],
    ]);

  // La fiche de la page consultée passe en tête : c'est le sujet implicite de
  // la question quand l'utilisateur ouvre le widget depuis une page cours.
  const courses = pinnedCourse
    ? [pinnedCourse, ...matchedCourses.filter((c) => c.slug !== pinnedCourse.slug)]
    : matchedCourses;

  const documents = [...matchedDocuments];
  const seen = new Set(documents.map((d) => d.sourceId));
  for (const doc of essentials) {
    if (!seen.has(doc.sourceId)) {
      seen.add(doc.sourceId);
      documents.push(doc);
    }
  }

  return { courses, documents, sessions };
}

/**
 * Faits stables sur le centre, identiques d'une question à l'autre.
 *
 * Ce bloc est placé AVANT le point de cache du prompt : il ne varie jamais,
 * donc il est payé une fois puis relu à 10 % du prix (voir src/lib/ai/assistant.ts).
 */
export function buildCentreFactsBlock(): string {
  return [
    "FICHE D'IDENTITÉ DU CENTRE (données vérifiées, citables telles quelles) :",
    `Nom : ${BRAND.name} (raison sociale ${BRAND.legalName})`,
    `Adresse : ${BRAND.address}`,
    `E-mail : ${BRAND.email}`,
    `Téléphone : ${BRAND.phone}`,
    `Mobile : ${BRAND.mobile}`,
    "Horaires : du lundi au vendredi de 8 h à 19 h, le samedi de 9 h à 17 h.",
    `SIREN : ${BRAND.siren}`,
    `Déclaration d'activité de formation : ${BRAND.activityDeclaration}`,
    `Certification Qualiopi : certificat ${BRAND.qualiopiCertificate}, valide jusqu'au ${BRAND.qualiopiValidUntil}`,
    `Site institutionnel : ${BRAND.website}`,
  ].join("\n");
}
