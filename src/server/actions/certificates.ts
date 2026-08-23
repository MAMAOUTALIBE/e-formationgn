"use server";

import { randomBytes } from "node:crypto";

import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import {
  CERTIFICATE_REQUIRES_COMPLETION,
  canIssueCertificate,
} from "@/lib/domain/training-integrity";
import { joinFullName } from "@/lib/identity-name";
import { prisma } from "@/lib/prisma";

import type { ActionResult } from "./auth";

// Suffixe imprévisible (8 octets → 16 hex). Remplace Math.random (prévisible,
// faible entropie) : un certificat ne doit pas être devinable par énumération.
function buildSerial(): string {
  const year = new Date().getFullYear();
  const random = randomBytes(8).toString("hex").toUpperCase();
  return `EFGN-${year}-${random}`;
}

/**
 * Formule les résultats de l'évaluation des acquis pour l'attestation.
 *
 * Une seule ligne par quiz, avec la meilleure tentative et le seuil de réussite
 * — de quoi permettre à un employeur ou à un financeur de juger le niveau
 * atteint. En l'absence de quiz, on l'écrit noir sur blanc plutôt que de laisser
 * la mention vide : une attestation muette sur ce point n'est pas conforme.
 */
function summarizeAssessment(
  attempts: Array<{
    score: number;
    quiz: { id: string; title: string; passingScore: number };
  }>,
): string {
  if (attempts.length === 0) {
    return "Évaluation des acquis réalisée en continu au fil des leçons ; aucune épreuve notée n'est associée à cette formation.";
  }
  const meilleures = new Map<string, (typeof attempts)[number]>();
  for (const tentative of attempts) {
    // La requête est triée par score décroissant : la première rencontrée est
    // donc déjà la meilleure.
    if (!meilleures.has(tentative.quiz.id)) meilleures.set(tentative.quiz.id, tentative);
  }
  return [...meilleures.values()]
    .map(
      (t) =>
        `${t.quiz.title} : ${Math.round(t.score)}/100 (seuil de réussite ${t.quiz.passingScore}/100 — ${
          t.score >= t.quiz.passingScore ? "acquis" : "non acquis"
        })`,
    )
    .join(" ; ");
}

export async function issueCertificate(courseId: string): Promise<ActionResult & { serialNumber?: string }> {
  const session = await auth();
  if (!session?.user) return { success: false, message: "Connectez-vous." };

  const [enrollment, holder, course, suivi, attempts] = await Promise.all([
    prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId } },
      select: { id: true, completedAt: true, progressPercent: true, orderItemId: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, firstName: true, lastName: true },
    }),
    // Objectifs figés à l'émission (cf. `Certificate.objectives`).
    prisma.course.findUnique({
      where: { id: courseId },
      select: { whatYouWillLearn: true },
    }),
    // Temps de connexion effectif et session au titre de laquelle l'attestation
    // est délivrée. Les deux sont figés à l'émission, comme le reste.
    prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId } },
      select: {
        registrationId: true,
        learningSessions: { select: { activeSeconds: true } },
      },
    }),
    // Résultats de l'évaluation des acquis : on retient la MEILLEURE tentative
    // de chaque quiz de la formation — c'est le niveau atteint qui est attesté,
    // pas le nombre d'essais.
    prisma.quizAttempt.findMany({
      where: {
        userId: session.user.id,
        quiz: { lesson: { section: { courseId } } },
      },
      select: {
        score: true,
        quiz: { select: { id: true, title: true, passingScore: true } },
      },
      orderBy: { score: "desc" },
    }),
  ]);
  if (!enrollment) {
    return { success: false, message: "Vous n'êtes pas inscrit à cette formation." };
  }
  if (!canIssueCertificate(enrollment)) {
    return {
      success: false,
      message: CERTIFICATE_REQUIRES_COMPLETION,
    };
  }

  // Idempotent : si un certificat existe déjà, on le réutilise.
  const existing = await prisma.certificate.findFirst({
    where: { userId: session.user.id, courseId },
    select: { id: true, serialNumber: true },
  });
  if (existing) {
    return { success: true, serialNumber: existing.serialNumber };
  }

  // Génère un numéro unique (réessais si collision rare).
  let serial = buildSerial();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.certificate.findUnique({
      where: { serialNumber: serial },
      select: { id: true },
    });
    if (!exists) break;
    serial = buildSerial();
  }

  let cert: { serialNumber: string };
  try {
    cert = await prisma.certificate.create({
      data: {
        userId: session.user.id,
        courseId,
        serialNumber: serial,
        orderItemId: enrollment.orderItemId,
        // Figé ici, jamais relu : c'est ce nom-là qui fait foi sur
        // l'attestation, même si le compte est renommé ensuite.
        holderName: joinFullName(holder ?? {}) || null,
        // Mentions imposées par l'article L.6353-1 du Code du travail, figées
        // au même titre que le nom du titulaire.
        objectives: course?.whatYouWillLearn ?? [],
        assessmentSummary: summarizeAssessment(attempts),
        completedSeconds:
          suivi?.learningSessions.reduce((total, s) => total + s.activeSeconds, 0) ?? 0,
        registrationId: suivi?.registrationId ?? null,
      },
      select: { serialNumber: true },
    });
  } catch (error) {
    // Deux clics concurrents peuvent franchir le premier SELECT. La contrainte
    // composite garantit l'idempotence ; le perdant réutilise l'attestation.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrent = await prisma.certificate.findFirst({
        where: { userId: session.user.id, courseId },
        select: { serialNumber: true },
      });
      if (concurrent) return { success: true, serialNumber: concurrent.serialNumber };
    }
    throw error;
  }

  return { success: true, serialNumber: cert.serialNumber };
}
