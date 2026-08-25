import "server-only";

// Service partagé : marque une leçon comme complétée et recalcule la
// progression de l'inscription, atomiquement.
//
// Évite l'éparpillement entre `learning.ts` (toggleLessonCompletion,
// recordLessonProgress) et `quiz.ts` (submitQuizAttempt sur passed) — qui
// avant cette factorisation faisaient des upserts désynchronisés. En
// particulier, quiz.ts ne recalculait PAS `Enrollment.progressPercent`
// après un quiz passé, ce qui laissait la barre de progression à jour.

import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { mergeLessonVideoMetrics } from "@/lib/lesson-video-progress";

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

async function serializableWithRetry<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt >= 2) throw error;
    }
  }
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

    const existing = await client.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: input.userId, lessonId: input.lessonId } },
      select: { watchedSeconds: true, lastPositionSeconds: true },
    });
    const metrics = mergeLessonVideoMetrics(existing, input);
    await client.lessonProgress.upsert({
      where: {
        userId_lessonId: { userId: input.userId, lessonId: input.lessonId },
      },
      update: {
        isCompleted: true,
        completedAt: new Date(),
        watchedSeconds: metrics.watchedSeconds,
        lastPositionSeconds: metrics.lastPositionSeconds,
      },
      create: {
        userId: input.userId,
        lessonId: input.lessonId,
        isCompleted: true,
        completedAt: new Date(),
        watchedSeconds: metrics.watchedSeconds,
        lastPositionSeconds: metrics.lastPositionSeconds,
      },
    });

    return recomputeEnrollmentProgress(client, input.userId, courseId);
  };

  return tx ? run(tx) : serializableWithRetry(run);
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
  await serializableWithRetry(async (tx) => {
    // Le contrôle est répété dans la même transaction que l'écriture : une
    // révocation concurrente d'accès ne laisse pas passer un rapport partiel.
    const lesson = await tx.lesson.findUnique({
      where: { id: input.lessonId },
      select: { isFreePreview: true, section: { select: { courseId: true } } },
    });
    if (!lesson) throw new Error("Leçon introuvable.");
    if (!lesson.isFreePreview) {
      const enrollment = await tx.enrollment.findUnique({
        where: { userId_courseId: { userId: input.userId, courseId: lesson.section.courseId } },
        select: { id: true },
      });
      if (!enrollment) throw new Error("Inscrivez-vous à la formation pour accéder à cette leçon.");
    }
    const where = { userId_lessonId: { userId: input.userId, lessonId: input.lessonId } };
    const existing = await tx.lessonProgress.findUnique({
      where,
      select: { watchedSeconds: true, lastPositionSeconds: true },
    });
    const metrics = mergeLessonVideoMetrics(existing, input);
    await tx.lessonProgress.upsert({
      where,
      update: metrics,
      create: {
        userId: input.userId,
        lessonId: input.lessonId,
        ...metrics,
        isCompleted: false,
      },
    });
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
