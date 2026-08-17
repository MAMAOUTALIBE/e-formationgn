import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { prisma } from "@/lib/prisma";

import { WIZARD_STEPS, stepHref } from "./wizard";

export interface WizardState {
  /** Slugs des étapes réellement renseignées (pour les pastilles ✓). */
  completedSlugs: string[];
  /**
   * Index (dans WIZARD_STEPS) de la première étape dont les prérequis
   * OBLIGATOIRES ne sont pas remplis. Les étapes d'index supérieur sont
   * verrouillées. Vaut WIZARD_STEPS.length quand tout est débloqué.
   *
   * Seuls Général et Programme imposent des prérequis ; Tarification et SEO
   * sont optionnels (un cours gratuit reste valide) et ne bloquent jamais.
   */
  unlockedMaxIndex: number;
}

// `cache` dédoublonne l'appel sur une même requête (layout + guard de page).
export const getWizardState = cache(
  async (courseId: string): Promise<WizardState> => {
    const c = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        title: true,
        description: true,
        categoryId: true,
        thumbnailUrl: true,
        metaTitle: true,
        whatYouWillLearn: true,
        sections: { select: { lessons: { select: { id: true } } } },
      },
    });

    if (!c) {
      return { completedSlugs: [], unlockedMaxIndex: 0 };
    }

    const titleOk = c.title.trim().length >= 5;
    const descriptionOk = c.description.trim().length >= 50;
    const categoryOk = c.categoryId.trim().length > 0;
    const thumbnailOk = Boolean(c.thumbnailUrl);
    const programmeOk =
      c.sections.length > 0 && c.sections.some((s) => s.lessons.length > 0);
    const seoOk =
      Boolean(c.metaTitle?.trim()) || c.whatYouWillLearn.length > 0;

    // Pastilles ✓ : complétion « contenu » réelle de chaque étape.
    const completedSlugs: string[] = [];
    if (titleOk && descriptionOk && thumbnailOk) completedSlugs.push("");
    if (programmeOk) completedSlugs.push("programme");
    if (seoOk) completedSlugs.push("seo");

    // Verrouillage : prérequis OBLIGATOIRES par étape (true = pas un blocage).
    const required = [
      titleOk && descriptionOk && categoryOk, // Général
      programmeOk, // Programme
      true, // SEO (optionnel)
    ];
    let unlockedMaxIndex = required.findIndex((ok) => !ok);
    if (unlockedMaxIndex === -1) unlockedMaxIndex = WIZARD_STEPS.length;

    return { completedSlugs, unlockedMaxIndex };
  },
);

/**
 * Guard serveur : redirige vers la première étape incomplète si l'étape
 * demandée est verrouillée (accès direct par URL). À appeler en tête des pages
 * d'étape (Programme / Tarification / SEO).
 */
export async function assertStepUnlocked(
  courseId: string,
  stepIndex: number,
): Promise<void> {
  const { unlockedMaxIndex } = await getWizardState(courseId);
  if (stepIndex > unlockedMaxIndex) {
    redirect(stepHref(courseId, WIZARD_STEPS[unlockedMaxIndex].slug));
  }
}
