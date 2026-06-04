// Définition de l'assistant de création de cours (parcours guidé).
//
// Les 4 étapes « création » sont ordonnées et numérotées : le formateur les
// remplit dans l'ordre, et chaque enregistrement valide l'envoie à la suivante
// (cf. useAdvanceOnSuccess). Insights & Annonces sont des outils post-création,
// affichés à part (non numérotés). La navigation reste libre — on guide sans
// verrouiller.

export interface WizardStep {
  /** Segment d'URL après /formateur/cours/[id] ("" = page Général racine). */
  slug: string;
  label: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { slug: "", label: "Général" },
  { slug: "programme", label: "Programme" },
  { slug: "tarification", label: "Tarification" },
  { slug: "seo", label: "SEO & Objectifs" },
];

export const SECONDARY_STEPS: WizardStep[] = [
  { slug: "insights", label: "Insights" },
  { slug: "annonces", label: "Annonces" },
];

export function stepHref(courseId: string, slug: string): string {
  const base = `/formateur/cours/${courseId}`;
  return slug ? `${base}/${slug}` : base;
}

/**
 * Index de l'étape « création » correspondant au pathname courant, ou -1 si on
 * est sur une page secondaire (Insights / Annonces) ou ailleurs.
 */
export function currentStepIndex(courseId: string, pathname: string): number {
  const base = `/formateur/cours/${courseId}`;
  // On parcourt à l'envers pour que les slugs non vides priment sur la racine.
  for (let i = WIZARD_STEPS.length - 1; i >= 0; i--) {
    const step = WIZARD_STEPS[i];
    if (step.slug === "") {
      if (pathname === base) return i;
    } else if (pathname.startsWith(stepHref(courseId, step.slug))) {
      return i;
    }
  }
  return -1;
}
