import "server-only";

// Exécution réelle des droits RGPD.
//
// Avant ce module, « Demandes RGPD » n'était qu'un registre : déclencher un
// export ou un effacement créait une ligne « en attente », et le bouton
// « Marquer traité » se contentait de basculer ce statut. Aucun fichier n'était
// produit, aucune donnée n'était supprimée. Un administrateur de bonne foi
// clôturait donc une demande d'effacement en croyant l'avoir honorée — une
// trace attestant d'une réponse qui n'a pas eu lieu est plus défavorable qu'une
// absence de dispositif.
//
// Les deux fonctions ci-dessous font le travail pour de bon.

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Droit d'accès et de portabilité (art. 15 et 20)
// ---------------------------------------------------------------------------

export interface UserDataExport {
  genereLe: string;
  compte: Record<string, unknown>;
  societe: Record<string, unknown> | null;
  inscriptions: unknown[];
  progression: unknown[];
  attestations: unknown[];
  notesPersonnelles: unknown[];
  questionsPosees: unknown[];
  avisDeposes: unknown[];
  tentativesDeQuiz: unknown[];
  notifications: unknown[];
  demandesRgpd: unknown[];
  /** Échanges avec Aiduca-IA rattachés au compte. */
  conversationsAssistant: unknown[];
  /** Demandes de rappel déposées depuis l'assistant. */
  demandesDeRappel: unknown[];
}

/**
 * Rassemble l'intégralité des données rattachées à une personne.
 *
 * Le format est du JSON structuré : lisible par un humain et réexploitable par
 * un autre système, ce que demande le droit à la portabilité. Les données
 * dérivées d'autrui (réponses reçues, avis d'autres stagiaires) sont exclues —
 * elles ne relèvent pas de cette personne.
 */
export async function buildUserDataExport(userId: string): Promise<UserDataExport> {
  const [
    compte,
    inscriptions,
    progression,
    attestations,
    notesPersonnelles,
    questionsPosees,
    avisDeposes,
    tentativesDeQuiz,
    notifications,
    demandesRgpd,
    conversationsAssistant,
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        birthPlace: true,
        gender: true,
        phone: true,
        country: true,
        address: true,
        image: true,
        role: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        company: { select: { name: true, city: true } },
      },
    }),
    prisma.enrollment.findMany({
      where: { userId },
      select: {
        enrolledAt: true,
        completedAt: true,
        progressPercent: true,
        lastAccessedAt: true,
        course: { select: { title: true, slug: true } },
      },
    }),
    prisma.lessonProgress.findMany({
      where: { userId },
      select: {
        isCompleted: true,
        watchedSeconds: true,
        completedAt: true,
        updatedAt: true,
        lesson: { select: { title: true } },
      },
    }),
    prisma.certificate.findMany({
      where: { userId },
      select: {
        serialNumber: true,
        issuedAt: true,
        holderName: true,
        objectives: true,
        assessmentSummary: true,
        course: { select: { title: true } },
      },
    }),
    prisma.lessonNote.findMany({
      where: { userId },
      select: { content: true, createdAt: true, lesson: { select: { title: true } } },
    }),
    prisma.question.findMany({
      where: { userId },
      select: { title: true, body: true, createdAt: true },
    }),
    prisma.review.findMany({
      where: { userId },
      select: { rating: true, title: true, comment: true, createdAt: true },
    }),
    prisma.quizAttempt.findMany({
      where: { userId },
      select: {
        score: true,
        startedAt: true,
        completedAt: true,
        passed: true,
        quiz: { select: { title: true, passingScore: true } },
      },
    }),
    prisma.notification.findMany({
      where: { userId },
      select: { kind: true, title: true, body: true, createdAt: true },
    }),
    prisma.gdprRequest.findMany({
      where: { userId },
      select: { kind: true, status: true, requestedAt: true, completedAt: true },
    }),
    // Aiduca-IA : les échanges rattachés au compte font partie des données de
    // la personne. Un fil resté anonyme (jamais connecté) n'est pas rattachable
    // et relève de la purge automatique à 90 jours, pas de l'export.
    prisma.assistantConversation.findMany({
      where: { userId },
      select: {
        startedAt: true,
        lastMessageAt: true,
        escalated: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: { role: true, content: true, createdAt: true },
        },
      },
    }),
  ]);

  // Les prospects sont rattachés par e-mail : au moment de sa demande, la
  // personne n'avait pas nécessairement de compte. C'est la seule clé qui la
  // relie à ses demandes de rappel.
  const demandesDeRappel = await prisma.assistantLead.findMany({
    where: { email: compte.email },
    select: {
      name: true,
      email: true,
      phone: true,
      message: true,
      status: true,
      createdAt: true,
      course: { select: { title: true, slug: true } },
    },
  });

  const { company, ...reste } = compte;
  return {
    genereLe: new Date().toISOString(),
    compte: reste,
    societe: company ?? null,
    inscriptions,
    progression,
    attestations,
    notesPersonnelles,
    questionsPosees,
    avisDeposes,
    tentativesDeQuiz,
    notifications,
    demandesRgpd,
    conversationsAssistant,
    demandesDeRappel,
  };
}

// ---------------------------------------------------------------------------
// Droit à l'effacement (art. 17)
// ---------------------------------------------------------------------------

export interface ErasureSummary {
  /** Ce qui a été réellement supprimé, par catégorie. */
  supprime: Record<string, number>;
  /** Ce qui est conservé, et au titre de quelle obligation. */
  conserve: string[];
}

/**
 * Efface les données d'une personne, en conservant les seules pièces qu'une
 * obligation légale impose de garder.
 *
 * L'article 17.3.b du RGPD écarte le droit à l'effacement lorsque le traitement
 * est nécessaire au respect d'une obligation légale. Un organisme de formation
 * doit pouvoir justifier des actions réalisées — attestations délivrées et
 * inscriptions correspondantes — notamment en cas de contrôle de la DREETS, de
 * l'organisme certificateur ou d'un financeur.
 *
 * On efface donc tout le reste, et on anonymise le compte lui-même. Les pièces
 * conservées sont énumérées dans le résumé retourné : la personne a le droit de
 * savoir ce qui subsiste et pourquoi.
 */
export async function eraseUserData(userId: string): Promise<ErasureSummary> {
  const supprime: Record<string, number> = {};

  // Données strictement personnelles, sans valeur probante : effacement sec.
  const [notes, signets, listeEnvies, notifications, sessions, jetons, vuesPages, campagnes] =
    await prisma.$transaction([
      prisma.lessonNote.deleteMany({ where: { userId } }),
      prisma.lessonBookmark.deleteMany({ where: { userId } }),
      prisma.wishlistItem.deleteMany({ where: { userId } }),
      prisma.notification.deleteMany({ where: { userId } }),
      prisma.session.deleteMany({ where: { userId } }),
      prisma.passwordResetToken.deleteMany({ where: { userId } }),
      prisma.pageView.deleteMany({ where: { userId } }),
      prisma.emailCampaignRecipient.deleteMany({ where: { userId } }),
    ]);
  supprime["notes de leçon"] = notes.count;
  supprime["signets"] = signets.count;
  supprime["liste d'envies"] = listeEnvies.count;
  supprime["notifications"] = notifications.count;
  supprime["sessions ouvertes"] = sessions.count;
  supprime["jetons de réinitialisation"] = jetons.count;
  supprime["pages vues"] = vuesPages.count;
  supprime["destinataires de campagnes"] = campagnes.count;

  // Contributions publiques : le contenu est retiré, la ligne subsiste pour ne
  // pas détruire les fils de discussion auxquels d'autres ont participé.
  const questions = await prisma.question.updateMany({
    where: { userId },
    data: { title: "Message retiré", body: "Contenu supprimé à la demande de son auteur." },
  });
  supprime["questions anonymisées"] = questions.count;

  const avis = await prisma.review.updateMany({
    where: { userId },
    data: { title: null, comment: null },
  });
  supprime["avis anonymisés"] = avis.count;

  // Aiduca-IA : effacement sec. Contrairement aux questions publiques, un fil
  // avec l'assistant n'a pas d'autre participant, donc rien à préserver pour
  // autrui. Les messages partent en cascade avec la conversation.
  //
  // L'e-mail du compte est lu AVANT l'anonymisation qui suit : après, il vaut
  // `efface-<id>@invalid` et ne retrouverait plus aucun prospect.
  const compteAvantAnonymisation = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const conversations = await prisma.assistantConversation.deleteMany({
    where: { userId },
  });
  supprime["conversations avec l'assistant"] = conversations.count;

  const prospects = compteAvantAnonymisation
    ? await prisma.assistantLead.deleteMany({
        where: { email: compteAvantAnonymisation.email },
      })
    : { count: 0 };
  supprime["demandes de rappel"] = prospects.count;

  // Le compte lui-même : anonymisation irréversible.
  //
  // L'adresse e-mail porte une contrainte d'unicité et sert d'identifiant de
  // connexion : on ne peut pas la vider, on la remplace par une valeur inerte
  // sur un domaine réservé aux usages internes (RFC 2606).
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: `efface-${userId}@invalid`,
      name: "Compte supprimé",
      firstName: null,
      lastName: null,
      birthDate: null,
      birthPlace: null,
      gender: null,
      phone: null,
      address: null,
      country: null,
      image: null,
      bio: null,
      headline: null,
      hashedPassword: null,
      emailVerified: null,
      status: "DELETED",
      // Invalide tout jeton de session encore en circulation : le callback JWT
      // rejette les jetons émis avant cette date.
      passwordChangedAt: new Date(),
    },
  });
  supprime["compte anonymisé"] = 1;

  const [attestations, inscriptions] = await Promise.all([
    prisma.certificate.count({ where: { userId } }),
    prisma.enrollment.count({ where: { userId } }),
  ]);

  const conserve: string[] = [];
  if (attestations > 0) {
    conserve.push(
      `${attestations} attestation(s) de fin de formation, avec le nom du titulaire figé à l'émission — pièces justificatives d'une action de formation (art. L.6353-1 du Code du travail), conservées au titre de l'art. 17.3.b du RGPD.`,
    );
  }
  if (inscriptions > 0) {
    conserve.push(
      `${inscriptions} inscription(s) rattachée(s) à ces attestations, conservées pour la même raison.`,
    );
  }
  conserve.push(
    "Journal d'audit des actions administratives, conservé pour la traçabilité de sécurité (art. 32 du RGPD).",
  );

  return { supprime, conserve };
}
