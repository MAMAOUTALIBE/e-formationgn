"use server";

// Server Action : génère puis sauve des questions de quiz IA pour une leçon.
// Réservée au formateur propriétaire (ou admin). Rate-limit dur (5/h) car la
// génération coûte plus cher que les autres features IA.

import { revalidatePath } from "next/cache";

import {
  AuthorizationError,
  requireLessonOwnership,
} from "@/lib/auth/authorization";
import { checkUserRateLimit, rateLimitMessage } from "@/lib/auth/rate-limit-ip";
import {
  generateQuizFromLesson,
  isQuizGenConfigured,
} from "@/lib/ai/quiz-generator";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export interface AiQuizGenResult {
  ok: boolean;
  message?: string;
  /** Nombre de questions ajoutées en DB. */
  added?: number;
}

export async function generateQuizQuestionsForLesson(
  lessonId: string,
): Promise<AiQuizGenResult> {
  try {
    if (!isQuizGenConfigured()) {
      return {
        ok: false,
        message: "Génération IA non configurée. Contactez l'administrateur.",
      };
    }

    const { userId, courseId } = await requireLessonOwnership(lessonId);

    const rl = checkUserRateLimit({
      prefix: "ai-quiz",
      userId,
      windowMs: 60 * 60 * 1000,
      max: 5,
    });
    if (!rl.ok) return { ok: false, message: rateLimitMessage(rl.resetAt) };

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        title: true,
        textContent: true,
        transcript: true,
        section: { select: { course: { select: { title: true } } } },
      },
    });
    if (!lesson) return { ok: false, message: "Leçon introuvable." };

    // Source : textContent prioritaire (édité par formateur), sinon transcript.
    const content =
      lesson.textContent && lesson.textContent.trim().length > 300
        ? lesson.textContent
        : (lesson.transcript ?? "");

    if (content.trim().length < 300) {
      return {
        ok: false,
        message:
          "Pas assez de contenu pour générer un quiz pertinent. Ajoutez du texte ou attendez la transcription Mux.",
      };
    }

    const generated = await generateQuizFromLesson({
      courseTitle: lesson.section.course.title,
      lessonTitle: lesson.title,
      content,
      count: 4,
    });

    if (generated.length === 0) {
      return {
        ok: false,
        message:
          "Impossible de générer un quiz exploitable à partir de ce contenu.",
      };
    }

    // Assure le quiz existe (lessonId @unique → upsert)
    const quiz = await prisma.quiz.upsert({
      where: { lessonId },
      update: {},
      create: {
        lessonId,
        title: lesson.title,
        passingScore: 70,
      },
      select: { id: true },
    });

    // Index de départ pour displayOrder : on AJOUTE à la fin, on n'écrase pas
    // les questions existantes (le formateur peut avoir édité manuellement).
    const lastIndex = await prisma.quizQuestion.aggregate({
      where: { quizId: quiz.id },
      _max: { displayOrder: true },
    });
    let nextOrder = (lastIndex._max.displayOrder ?? -1) + 1;

    // Insertion en transaction pour cohérence question/options.
    await prisma.$transaction(async (tx) => {
      for (const q of generated) {
        await tx.quizQuestion.create({
          data: {
            quizId: quiz.id,
            prompt: q.prompt,
            kind: q.kind,
            displayOrder: nextOrder,
            points: 1,
            explanation: q.explanation ?? null,
            options: {
              create: q.options.map((o, i) => ({
                label: o.label,
                isCorrect: o.isCorrect,
                displayOrder: i,
              })),
            },
          },
        });
        nextOrder += 1;
      }
    });

    revalidatePath(`/formateur/cours/${courseId}/lecons/${lessonId}`);

    return { ok: true, added: generated.length };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, message: error.message };
    }
    logError("ai-quiz", error, { lessonId });
    return { ok: false, message: "Échec de la génération du quiz." };
  }
}
