"use server";

// Server Action : pose une question au tuteur IA pour une leçon donnée.
// Vérifie : (1) auth, (2) inscription au cours qui contient la leçon,
// (3) rate limit (10 questions / heure / utilisateur).

import { auth } from "@/auth";
import { askTutor, isTutorConfigured } from "@/lib/ai/tutor";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

interface TutorActionResult {
  ok: boolean;
  message?: string;
  answer?: string;
}

export async function askLessonTutor(
  lessonId: string,
  question: string,
): Promise<TutorActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, message: "Connectez-vous pour utiliser le tuteur." };
  }

  if (!isTutorConfigured()) {
    return {
      ok: false,
      message: "Le tuteur IA n'est pas activé sur cette plateforme.",
    };
  }

  const trimmed = question.trim();
  if (trimmed.length < 5) {
    return { ok: false, message: "Pose une question plus précise." };
  }
  if (trimmed.length > 1500) {
    return { ok: false, message: "Question trop longue (max 1500 caractères)." };
  }

  // Rate limit : 10 questions par heure et par utilisateur
  const rl = checkRateLimit({
    key: `tutor:${session.user.id}`,
    windowMs: 60 * 60 * 1000,
    max: 10,
  });
  if (!rl.ok) {
    const minutes = Math.ceil((rl.resetAt - Date.now()) / 60_000);
    return {
      ok: false,
      message: `Limite atteinte (10 questions / h). Réessaye dans ${minutes} min.`,
    };
  }

  // Vérifie que l'élève est inscrit au cours qui contient la leçon
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      title: true,
      description: true,
      textContent: true,
      transcript: true,
      section: {
        select: {
          course: { select: { id: true, title: true } },
        },
      },
    },
  });
  if (!lesson) return { ok: false, message: "Leçon introuvable." };

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId: lesson.section.course.id,
      },
    },
    select: { id: true },
  });
  if (!enrollment) {
    return {
      ok: false,
      message: "Inscris-toi au cours pour utiliser le tuteur.",
    };
  }

  try {
    const result = await askTutor(
      {
        courseTitle: lesson.section.course.title,
        lessonTitle: lesson.title,
        lessonDescription: lesson.description,
        lessonContent: lesson.textContent ?? lesson.transcript,
      },
      trimmed,
    );
    return { ok: true, answer: result.text };
  } catch (error) {
    console.error("[tutor] erreur Anthropic", error);
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Échec du tuteur — réessaye dans un instant.",
    };
  }
}
