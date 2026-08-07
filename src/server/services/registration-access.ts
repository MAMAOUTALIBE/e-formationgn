import "server-only";

// Dérivation des accès à partir des inscriptions.
//
// Une inscription ne remplace pas `Enrollment` : elle le COMMANDE. Les six
// points de contrôle d'accès de l'application (lecteur de cours, tuteur IA,
// Q&A, panier…) interrogent déjà `Enrollment` ; en pilotant cette table plutôt
// qu'en la doublant, aucun de ces contrôles n'a besoin d'être modifié — donc
// aucun risque d'en oublier un et de laisser une porte ouverte.
//
// Conséquence directe du point 9 du cahier des charges : un élève ne voit que
// ce qui lui est réellement attribué, parce que « attribué » et « visible »
// sont la même donnée.

import { prisma } from "@/lib/prisma";

/** Seul ce statut ouvre les accès. */
const GRANTING_STATUSES = new Set(["ACTIVE"]);

export interface AccessSyncResult {
  granted: number;
  revoked: number;
  /** Cours du programme au moment de la synchronisation. */
  courseIds: string[];
}

/**
 * Aligne les accès d'un élève sur l'état de son inscription.
 *
 * Idempotent : appelable autant de fois que voulu, il ne fait que la
 * différence entre l'état voulu et l'état réel.
 */
export async function syncRegistrationAccess(
  registrationId: string,
): Promise<AccessSyncResult> {
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      studentId: true,
      status: true,
      session: {
        select: {
          program: {
            select: { courses: { select: { courseId: true } } },
          },
        },
      },
    },
  });

  if (!registration) return { granted: 0, revoked: 0, courseIds: [] };

  const courseIds = registration.session.program.courses.map((c) => c.courseId);
  if (courseIds.length === 0) return { granted: 0, revoked: 0, courseIds: [] };

  const shouldHaveAccess = GRANTING_STATUSES.has(registration.status);

  // Accès déjà en place pour ces cours.
  const existing = await prisma.enrollment.findMany({
    where: { userId: registration.studentId, courseId: { in: courseIds } },
    select: { id: true, courseId: true },
  });
  const existingByCourse = new Map(existing.map((e) => [e.courseId, e.id]));

  if (shouldHaveAccess) {
    const missing = courseIds.filter((id) => !existingByCourse.has(id));
    if (missing.length === 0) return { granted: 0, revoked: 0, courseIds };

    // `progressPercent` est recalculé depuis `LessonProgress`, qui a survécu à
    // une éventuelle suspension : réactiver ne remet pas l'élève à zéro.
    const restored = await Promise.all(
      missing.map(async (courseId) => ({
        courseId,
        progressPercent: await computeProgressPercent(registration.studentId, courseId),
      })),
    );

    await prisma.enrollment.createMany({
      data: restored.map((r) => ({
        userId: registration.studentId,
        courseId: r.courseId,
        source: "ADMIN_GRANT" as const,
        progressPercent: r.progressPercent,
      })),
      // Une inscription à deux sessions partageant un cours ne doit pas
      // échouer sur la contrainte d'unicité.
      skipDuplicates: true,
    });

    return { granted: missing.length, revoked: 0, courseIds };
  }

  // Retrait. On ne touche QUE les cours que cette inscription justifiait, et
  // seulement si aucune autre inscription active de l'élève ne les couvre —
  // sinon suspendre une inscription couperait l'accès accordé par une autre.
  const stillJustified = await coursesJustifiedByOtherRegistrations(
    registration.studentId,
    registration.id,
  );
  const toRevoke = courseIds.filter((id) => !stillJustified.has(id));

  const revokableIds = toRevoke
    .map((courseId) => existingByCourse.get(courseId))
    .filter((id): id is string => Boolean(id));

  if (revokableIds.length === 0) return { granted: 0, revoked: 0, courseIds };

  await prisma.enrollment.deleteMany({ where: { id: { in: revokableIds } } });
  return { granted: 0, revoked: revokableIds.length, courseIds };
}

/**
 * Cours couverts par les AUTRES inscriptions actives de l'élève.
 *
 * Sans ce garde-fou, un élève inscrit à deux formations partageant un cours
 * perdrait l'accès à ce cours dès qu'on suspend l'une des deux.
 */
async function coursesJustifiedByOtherRegistrations(
  studentId: string,
  excludeRegistrationId: string,
): Promise<Set<string>> {
  const others = await prisma.registration.findMany({
    where: {
      studentId,
      id: { not: excludeRegistrationId },
      status: { in: ["ACTIVE"] },
    },
    select: {
      session: {
        select: { program: { select: { courses: { select: { courseId: true } } } } },
      },
    },
  });

  const set = new Set<string>();
  for (const r of others) {
    for (const c of r.session.program.courses) set.add(c.courseId);
  }
  return set;
}

/**
 * Recalcule l'avancement d'un élève sur un cours depuis `LessonProgress`.
 *
 * `Enrollment.progressPercent` n'est qu'un cache : la vérité est dans les
 * leçons terminées, indexées par `[userId, lessonId]` et donc indépendantes de
 * l'inscription. C'est ce qui permet de suspendre puis réactiver sans perte.
 */
async function computeProgressPercent(userId: string, courseId: string): Promise<number> {
  const [total, completed] = await Promise.all([
    prisma.lesson.count({ where: { section: { courseId } } }),
    prisma.lessonProgress.count({
      where: { userId, isCompleted: true, lesson: { section: { courseId } } },
    }),
  ]);
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}
