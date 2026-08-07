import "server-only";

// Compteurs affichés en pastille dans la barre latérale de l'espace formateur.
//
// Volontairement limité à ce qui appelle une action du formateur : une
// question d'élève restée sans sa réponse. Le reste de l'espace (avis,
// paiements, codes promo) se consulte, mais n'attend rien de lui.

import { prisma } from "@/lib/prisma";

/** Alias de type — la coquille attend un `Record<string, number>`. */
export type InstructorSidebarBadges = {
  pendingQuestions: number;
};

export async function getInstructorSidebarBadges(
  instructorId: string,
): Promise<InstructorSidebarBadges> {
  // « Sans réponse » = sans réponse DU FORMATEUR. Un autre élève qui répond ne
  // décharge pas le formateur de la sienne : le critère porte donc sur
  // l'auteur, pas sur l'existence d'une réponse.
  const pendingQuestions = await prisma.question.count({
    where: {
      course: { instructorId },
      answers: { none: { userId: instructorId } },
    },
  });

  return { pendingQuestions };
}
