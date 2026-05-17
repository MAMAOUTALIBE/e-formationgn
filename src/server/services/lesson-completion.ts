import "server-only";

// Service partagé : marque une leçon comme complétée et recalcule la
// progression de l'inscription, atomiquement.
//
// Évite l'éparpillement entre `learning.ts` (toggleLessonCompletion,
// recordLessonProgress) et `quiz.ts` (submitQuizAttempt sur passed) — qui
// avant cette factorisation faisaient des upserts désynchronisés. En
// particulier, quiz.ts ne recalculait PAS `Enrollment.progressPercent`
// après un quiz passé, ce qui laissait la barre de progression à jour.

import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

interface MarkLessonCompletedInput {
  userId: string;
  lessonId: string;
  // Pour ne pas refaire un SELECT si le caller connaît déjà le courseId
  // (par ex. après auth/ownership check).
  courseId?: string;
  // Métriques optionnelles à upserter en même temps (vidéo).
  watchedSeconds?: number;
  lastPositionSeconds?: number;
}

export interface LessonCompletionResult {
  progressPercent: number;
  totalLessons: number;
  completedLessons: number;
  enrollmentCompletedAt: Date | null;
}

/**
 * Upsert LessonProgress(isCompleted=true) + recompute Enrollment progress.
 *
 * Si un `tx` est fourni, les deux opérations s'enchaînent dedans (utile
 * quand le caller a déjà ouvert une transaction, par ex. submitQuizAttempt).
 * Sinon on en ouvre une localement pour garantir l'atomicité.
 */
export async function markLessonCompleted(
  input: MarkLessonCompletedInput,
  tx?: Tx,
): Promise<LessonCompletionResult> {
  const run = async (client: Tx | typeof prisma) => {
    const courseId = input.courseId ?? (await resolveCourseId(client, input.lessonId));
    if (!courseId) {
      throw new Error("Leçon introuvable (courseId non résolu).");
    }

    await client.lessonProgress.upsert({
      where: {
        userId_lessonId: { userId: input.userId, lessonId: input.lessonId },
      },
      update: {
        isCompleted: true,
        completedAt: new Date(),
        ...(input.watchedSeconds !== undefined ? { watchedSeconds: input.watchedSeconds } : {}),
        ...(input.lastPositionSeconds !== undefined
          ? { lastPositionSeconds: input.lastPositionSeconds }
          : {}),
      },
      create: {
        userId: input.userId,
        lessonId: input.lessonId,
        isCompleted: true,
        completedAt: new Date(),
        watchedSeconds: input.watchedSeconds ?? 0,
        lastPositionSeconds: input.lastPositionSeconds ?? 0,
      },
    });

    return recomputeEnrollmentProgress(client, input.userId, courseId);
  };

  return tx ? run(tx) : prisma.$transaction((t) => run(t));
}

/**
 * Toggle (uncomplete) : remet isCompleted=false et recalcule la progression.
 * Toujours atomique.
 */
export async function unmarkLessonCompleted(
  input: { userId: string; lessonId: string; courseId?: string },
  tx?: Tx,
): Promise<LessonCompletionResult> {
  const run = async (client: Tx | typeof prisma) => {
    const courseId = input.courseId ?? (await resolveCourseId(client, input.lessonId));
    if (!courseId) throw new Error("Leçon introuvable (courseId non résolu).");

    await client.lessonProgress.upsert({
      where: { userId_lessonId: { userId: input.userId, lessonId: input.lessonId } },
      update: { isCompleted: false, completedAt: null },
      create: {
        userId: input.userId,
        lessonId: input.lessonId,
        isCompleted: false,
      },
    });

    return recomputeEnrollmentProgress(client, input.userId, courseId);
  };

  return tx ? run(tx) : prisma.$transaction((t) => run(t));
}

/**
 * Met à jour LessonProgress avec des métriques (sans toucher isCompleted).
 * Cas du `recordLessonProgress` partiel — pas de recompute (progress % ne
 * change pas tant qu'on n'a pas validé la complétion).
 */
export async function recordLessonProgressFields(
  input: {
    userId: string;
    lessonId: string;
    watchedSeconds?: number;
    lastPositionSeconds?: number;
  },
): Promise<void> {
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: input.userId, lessonId: input.lessonId } },
    update: {
      ...(input.watchedSeconds !== undefined ? { watchedSeconds: input.watchedSeconds } : {}),
      ...(input.lastPositionSeconds !== undefined
        ? { lastPositionSeconds: input.lastPositionSeconds }
        : {}),
    },
    create: {
      userId: input.userId,
      lessonId: input.lessonId,
      watchedSeconds: input.watchedSeconds ?? 0,
      lastPositionSeconds: input.lastPositionSeconds ?? 0,
      isCompleted: false,
    },
  });
}

// ---------------------------------------------------------------------------
// Internes
// ---------------------------------------------------------------------------

async function resolveCourseId(
  client: Tx | typeof prisma,
  lessonId: string,
): Promise<string | null> {
  const lesson = await client.lesson.findUnique({
    where: { id: lessonId },
    select: { section: { select: { courseId: true } } },
  });
  return lesson?.section.courseId ?? null;
}

async function recomputeEnrollmentProgress(
  client: Tx | typeof prisma,
  userId: string,
  courseId: string,
): Promise<LessonCompletionResult> {
  const [totalLessons, completedLessons] = await Promise.all([
    client.lesson.count({ where: { section: { courseId } } }),
    client.lessonProgress.count({
      where: {
        userId,
        isCompleted: true,
        lesson: { section: { courseId } },
      },
    }),
  ]);

  const percent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
  const enrollmentCompletedAt =
    totalLessons > 0 && completedLessons === totalLessons ? new Date() : null;

  await client.enrollment.update({
    where: { userId_courseId: { userId, courseId } },
    data: {
      progressPercent: percent,
      lastAccessedAt: new Date(),
      // Conserve une éventuelle valeur existante : on ne **réinitialise pas**
      // completedAt à null si on déplace la barre de 100 % à 80 % (toggle).
      // C'est la sémantique « le cours a été complété au moins une fois ».
      completedAt: enrollmentCompletedAt ?? undefined,
    },
  });

  return {
    progressPercent: percent,
    totalLessons,
    completedLessons,
    enrollmentCompletedAt,
  };
}
