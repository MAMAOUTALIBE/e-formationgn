// Réparation idempotente des deux incohérences relevées en préproduction.
//
// Lecture seule par défaut :
//   npx tsx scripts/repair-training-integrity.ts
//
// L'écriture exige deux confirmations distinctes :
//   npx tsx scripts/repair-training-integrity.ts --apply \
//     --confirm=REPAIR_TRAINING_INTEGRITY \
//     --confirm-production=I_HAVE_A_VERIFIED_BACKUP
//
// Le script n'affiche aucun identifiant, nom, e-mail ou numéro d'attestation.

import "dotenv/config";

import { prisma } from "../src/lib/prisma";

const APPLY_CONFIRMATION = "--confirm=REPAIR_TRAINING_INTEGRITY";
const BACKUP_CONFIRMATION = "--confirm-production=I_HAVE_A_VERIFIED_BACKUP";

async function inspectRecoverableCertificates() {
  const certificates = await prisma.certificate.findMany({
    select: { userId: true, courseId: true },
  });

  const recoverable: Array<{ userId: string; courseId: string; enrolledAt: Date; completedAt: Date }> = [];
  let notRecoverable = 0;

  for (const certificate of certificates) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId: certificate.userId, courseId: certificate.courseId },
      },
      select: { id: true },
    });
    if (enrollment) continue;

    const lessons = await prisma.lesson.findMany({
      where: { section: { courseId: certificate.courseId } },
      select: { id: true },
    });
    if (lessons.length === 0) {
      notRecoverable += 1;
      continue;
    }

    const progress = await prisma.lessonProgress.findMany({
      where: {
        userId: certificate.userId,
        lessonId: { in: lessons.map((lesson) => lesson.id) },
        isCompleted: true,
        completedAt: { not: null },
      },
      select: { createdAt: true, completedAt: true },
    });
    if (progress.length !== lessons.length) {
      notRecoverable += 1;
      continue;
    }

    const completedDates = progress.flatMap((item) => (item.completedAt ? [item.completedAt] : []));
    recoverable.push({
      userId: certificate.userId,
      courseId: certificate.courseId,
      enrolledAt: new Date(Math.min(...progress.map((item) => item.createdAt.getTime()))),
      completedAt: new Date(Math.max(...completedDates.map((date) => date.getTime()))),
    });
  }

  return { recoverable, notRecoverable };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const confirmed = process.argv.includes(APPLY_CONFIRMATION);
  const backupConfirmed = process.argv.includes(BACKUP_CONFIRMATION);
  if (apply && (!confirmed || !backupConfirmed)) {
    throw new Error(
      `Écriture refusée : ajoutez ${APPLY_CONFIRMATION} et ${BACKUP_CONFIRMATION}.`,
    );
  }

  const activeProgramsWithoutCourses = await prisma.program.count({
    where: { status: "ACTIVE", courses: { none: {} } },
  });
  const { recoverable, notRecoverable } = await inspectRecoverableCertificates();

  console.log(`Programmes actifs à repasser en brouillon : ${activeProgramsWithoutCourses}`);
  console.log(`Inscriptions manquantes reconstructibles : ${recoverable.length}`);
  console.log(`Attestations non reconstructibles, laissées intactes : ${notRecoverable}`);

  if (!apply) {
    console.log(`Lecture seule. Pour appliquer : --apply ${APPLY_CONFIRMATION} ${BACKUP_CONFIRMATION}`);
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const programs = await tx.program.updateMany({
      where: { status: "ACTIVE", courses: { none: {} } },
      data: { status: "DRAFT" },
    });
    let enrollmentsCreated = 0;
    for (const item of recoverable) {
      const enrollment = await tx.enrollment.createMany({
        data: [{
          userId: item.userId,
          courseId: item.courseId,
          source: "ADMIN_GRANT",
          progressPercent: 100,
          enrolledAt: item.enrolledAt,
          completedAt: item.completedAt,
          lastAccessedAt: item.completedAt,
        }],
        skipDuplicates: true,
      });
      enrollmentsCreated += enrollment.count;
    }
    return { programsUpdated: programs.count, enrollmentsCreated };
  });

  console.log(`Programmes corrigés : ${result.programsUpdated}`);
  console.log(`Inscriptions créées : ${result.enrollmentsCreated}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Erreur de réparation inconnue");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
