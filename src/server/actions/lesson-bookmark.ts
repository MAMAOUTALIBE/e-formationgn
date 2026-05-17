"use server";

// Toggle bookmark sur une leçon. Vérifie que l'utilisateur est connecté
// ET inscrit au cours (ou que la leçon est `isFreePreview`) — pas de bookmark
// sur des leçons auxquelles on n'a pas accès.

import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";

import type { ActionResult } from "./auth";

export async function toggleLessonBookmark(
  lessonId: string,
): Promise<ActionResult & { bookmarked?: boolean }> {
  const { userId } = await requireSession();

  // Garde-fou : vérifier l'accès au cours via Enrollment (ou preview).
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      isFreePreview: true,
      section: {
        select: { courseId: true, course: { select: { slug: true } } },
      },
    },
  });
  if (!lesson) return { success: false, message: "Leçon introuvable." };

  if (!lesson.isFreePreview) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId, courseId: lesson.section.courseId },
      },
      select: { id: true },
    });
    if (!enrollment) {
      return { success: false, message: "Vous n'avez pas accès à cette leçon." };
    }
  }

  const existing = await prisma.lessonBookmark.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: { id: true },
  });

  let bookmarked: boolean;
  if (existing) {
    await prisma.lessonBookmark.delete({ where: { id: existing.id } });
    bookmarked = false;
  } else {
    await prisma.lessonBookmark.create({ data: { userId, lessonId } });
    bookmarked = true;
  }

  revalidatePath(`/apprentissage/${lesson.section.course.slug}/lecons/${lessonId}`);
  return {
    success: true,
    bookmarked,
    message: bookmarked ? "Leçon sauvegardée." : "Leçon retirée des sauvegardes.",
  };
}
