"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  markLessonCompleted,
  recordLessonProgressFields,
  unmarkLessonCompleted,
} from "@/server/services/lesson-completion";
import {
  lessonNoteSchema,
  lessonProgressSchema,
} from "@/lib/validators/learning";
import { computeHeartbeatCredit } from "@/lib/learning-tracking";

import type { ActionResult } from "./auth";

async function requireLessonAccess(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { section: { select: { courseId: true } } },
  });
  if (!lesson) throw new Error("Leçon introuvable.");
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: { userId, courseId: lesson.section.courseId },
    },
    select: { id: true },
  });
  if (!enrollment && !lesson.isFreePreview) {
    throw new Error("Inscrivez-vous au cours pour accéder à cette leçon.");
  }
  return { lesson, courseId: lesson.section.courseId };
}

export async function recordLessonProgress(
  input: unknown,
): Promise<ActionResult & { progressPercent?: number }> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, message: "Vous devez être connecté." };
  }
  const parsed = lessonProgressSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Données invalides." };
  }
  const userId = session.user.id;
  const { courseId } = await requireLessonAccess(userId, parsed.data.lessonId);

  // Trois cas :
  // - isCompleted === true   → délègue à markLessonCompleted (transaction +
  //   recompute Enrollment.progressPercent atomique)
  // - isCompleted === false  → délègue à unmarkLessonCompleted
  // - isCompleted undefined  → update partiel des métriques vidéo seulement,
  //   pas besoin de recompute (le pourcentage ne change pas)
  if (parsed.data.isCompleted === true) {
    const result = await markLessonCompleted({
      userId,
      lessonId: parsed.data.lessonId,
      courseId,
      watchedSeconds: parsed.data.watchedSeconds,
      lastPositionSeconds: parsed.data.lastPositionSeconds,
    });
    return { success: true, progressPercent: result.progressPercent };
  }

  if (parsed.data.isCompleted === false) {
    const result = await unmarkLessonCompleted({
      userId,
      lessonId: parsed.data.lessonId,
      courseId,
    });
    return { success: true, progressPercent: result.progressPercent };
  }

  await recordLessonProgressFields({
    userId,
    lessonId: parsed.data.lessonId,
    watchedSeconds: parsed.data.watchedSeconds,
    lastPositionSeconds: parsed.data.lastPositionSeconds,
  });
  return { success: true };
}

export async function recordLearningHeartbeat(input: {
  lessonId: string;
  sessionKey: string;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    return { success: false, message: "Accès élève requis." };
  }
  if (
    typeof input?.lessonId !== "string" || input.lessonId.length > 100 ||
    typeof input?.sessionKey !== "string" || !/^[a-zA-Z0-9-]{16,100}$/.test(input.sessionKey)
  ) return { success: false, message: "Données invalides." };

  const lesson = await prisma.lesson.findUnique({
    where: { id: input.lessonId },
    select: { section: { select: { courseId: true } } },
  });
  if (!lesson) return { success: false, message: "Leçon introuvable." };
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: lesson.section.courseId } },
    select: { id: true },
  });
  if (!enrollment) return { success: false, message: "Inscription requise." };

  const now = new Date();
  const accepted = await prisma.$transaction(async (tx) => {
    const existing = await tx.learningSession.findUnique({ where: { sessionKey: input.sessionKey } });
    if (existing && (existing.userId !== session.user.id || existing.lessonId !== input.lessonId)) {
      return false;
    }
    if (existing) {
      const credit = computeHeartbeatCredit(existing.lastHeartbeatAt, now);
      // La condition sur l'ancien timestamp empêche deux requêtes concurrentes
      // de créditer deux fois le même intervalle.
      await tx.learningSession.updateMany({
        where: { id: existing.id, lastHeartbeatAt: existing.lastHeartbeatAt },
        data: { lastHeartbeatAt: now, activeSeconds: { increment: credit } },
      });
    } else {
      await tx.learningSession.create({ data: {
        sessionKey: input.sessionKey, userId: session.user.id,
        enrollmentId: enrollment.id, lessonId: input.lessonId,
        lastHeartbeatAt: now,
      } });
    }
    await tx.enrollment.update({ where: { id: enrollment.id }, data: { lastAccessedAt: now } });
    return true;
  });
  if (!accepted) return { success: false, message: "Session de suivi invalide." };
  return { success: true };
}

export async function toggleLessonCompletion(lessonId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, message: "Connectez-vous." };

  const userId = session.user.id;
  const { courseId } = await requireLessonAccess(userId, lessonId);

  const existing = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: { isCompleted: true },
  });

  const nextCompleted = !(existing?.isCompleted ?? false);
  if (nextCompleted) {
    await markLessonCompleted({ userId, lessonId, courseId });
  } else {
    await unmarkLessonCompleted({ userId, lessonId, courseId });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { section: { include: { course: true } } },
  });
  if (lesson) {
    revalidatePath(`/apprentissage/${lesson.section.course.slug}`);
    revalidatePath(`/apprentissage/${lesson.section.course.slug}/lecons/${lessonId}`);
  }
  return { success: true };
}

// ----- Notes ---------------------------------------------------------------

export async function createLessonNote(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, message: "Connectez-vous." };

  const parsed = lessonNoteSchema.safeParse({
    lessonId: formData.get("lessonId"),
    content: formData.get("content"),
    videoTimestampSeconds: formData.get("videoTimestampSeconds") ?? undefined,
  });
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await requireLessonAccess(session.user.id, parsed.data.lessonId);
  await prisma.lessonNote.create({
    data: {
      userId: session.user.id,
      lessonId: parsed.data.lessonId,
      content: parsed.data.content,
      videoTimestampSeconds: parsed.data.videoTimestampSeconds ?? null,
    },
  });

  const lesson = await prisma.lesson.findUnique({
    where: { id: parsed.data.lessonId },
    include: { section: { include: { course: true } } },
  });
  if (lesson) {
    revalidatePath(`/apprentissage/${lesson.section.course.slug}/lecons/${parsed.data.lessonId}`);
  }
  return { success: true, message: "Note enregistrée." };
}

export async function deleteLessonNote(noteId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, message: "Connectez-vous." };
  const note = await prisma.lessonNote.findUnique({
    where: { id: noteId },
    include: { lesson: { include: { section: { include: { course: true } } } } },
  });
  if (!note || note.userId !== session.user.id) {
    return { success: false, message: "Note introuvable." };
  }
  await prisma.lessonNote.delete({ where: { id: noteId } });
  revalidatePath(
    `/apprentissage/${note.lesson.section.course.slug}/lecons/${note.lessonId}`,
  );
  return { success: true };
}
