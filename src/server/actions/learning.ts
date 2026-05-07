"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  lessonNoteSchema,
  lessonProgressSchema,
} from "@/lib/validators/learning";

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

async function recomputeAndPersistEnrollmentProgress(
  userId: string,
  courseId: string,
) {
  const [total, completed] = await Promise.all([
    prisma.lesson.count({ where: { section: { courseId } } }),
    prisma.lessonProgress.count({
      where: { userId, isCompleted: true, lesson: { section: { courseId } } },
    }),
  ]);
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const completedAt = total > 0 && completed === total ? new Date() : null;

  await prisma.enrollment.update({
    where: { userId_courseId: { userId, courseId } },
    data: {
      progressPercent: percent,
      lastAccessedAt: new Date(),
      completedAt: completedAt ?? undefined,
    },
  });
  return { percent, totalLessons: total, completedLessons: completed };
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

  const data: {
    watchedSeconds?: number;
    lastPositionSeconds?: number;
    isCompleted?: boolean;
    completedAt?: Date | null;
  } = {};
  if (parsed.data.watchedSeconds !== undefined) data.watchedSeconds = parsed.data.watchedSeconds;
  if (parsed.data.lastPositionSeconds !== undefined)
    data.lastPositionSeconds = parsed.data.lastPositionSeconds;
  if (parsed.data.isCompleted !== undefined) {
    data.isCompleted = parsed.data.isCompleted;
    data.completedAt = parsed.data.isCompleted ? new Date() : null;
  }

  await prisma.lessonProgress.upsert({
    where: {
      userId_lessonId: { userId, lessonId: parsed.data.lessonId },
    },
    update: data,
    create: {
      userId,
      lessonId: parsed.data.lessonId,
      watchedSeconds: data.watchedSeconds ?? 0,
      lastPositionSeconds: data.lastPositionSeconds ?? 0,
      isCompleted: data.isCompleted ?? false,
      completedAt: data.completedAt ?? null,
    },
  });

  const stats = await recomputeAndPersistEnrollmentProgress(userId, courseId);
  return { success: true, progressPercent: stats.percent };
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
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { isCompleted: nextCompleted, completedAt: nextCompleted ? new Date() : null },
    create: {
      userId,
      lessonId,
      isCompleted: nextCompleted,
      completedAt: nextCompleted ? new Date() : null,
    },
  });

  await recomputeAndPersistEnrollmentProgress(userId, courseId);

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
