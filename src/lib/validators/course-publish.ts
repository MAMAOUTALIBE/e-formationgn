// Critères de QUALITÉ exigés avant publication d'un cours.
//
// Source de vérité partagée entre la modération admin (garde serveur dans
// moderateCourse / approveCourse) et l'affichage de la checklist côté UI.
// Aligné sur la porte d'entrée formateur (submitCourseForReview) + rejet
// explicite de la description par défaut générée à la création d'un cours.

/** Description par défaut posée à la création (cf. instructor.ts createCourse). */
export const PLACEHOLDER_DESCRIPTION =
  "Décrivez votre cours pour aider les élèves à comprendre ce qu'ils vont apprendre.";

export interface PublishCriterion {
  key: string;
  label: string;
  ok: boolean;
}

export interface PublishableCourse {
  title: string;
  description: string;
  thumbnailUrl: string | null;
  sections: { lessons: unknown[] }[];
}

export function getPublishCriteria(c: PublishableCourse): PublishCriterion[] {
  const desc = (c.description ?? "").trim();
  const totalLessons = c.sections.reduce((n, s) => n + s.lessons.length, 0);
  return [
    {
      key: "title",
      label: "Titre (≥ 5 caractères)",
      ok: (c.title ?? "").trim().length >= 5,
    },
    {
      key: "description",
      label: "Description réelle (≥ 50 caractères, ≠ texte par défaut)",
      ok: desc.length >= 50 && desc !== PLACEHOLDER_DESCRIPTION,
    },
    {
      key: "thumbnail",
      label: "Image de couverture",
      ok: Boolean(c.thumbnailUrl),
    },
    {
      key: "section",
      label: "Au moins une section",
      ok: c.sections.length >= 1,
    },
    {
      key: "lesson",
      label: "Au moins une leçon",
      ok: totalLessons >= 1,
    },
  ];
}

export function isCoursePublishable(c: PublishableCourse): boolean {
  return getPublishCriteria(c).every((x) => x.ok);
}

export function failedCriteriaLabels(c: PublishableCourse): string[] {
  return getPublishCriteria(c)
    .filter((x) => !x.ok)
    .map((x) => x.label);
}
