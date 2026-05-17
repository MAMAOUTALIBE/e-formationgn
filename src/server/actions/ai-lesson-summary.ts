"use server";

// Server Action : génère / régénère le résumé IA d'une leçon. Réservée au
// formateur propriétaire (ou admin). Rate-limit dur (10/h par formateur).

import { revalidatePath } from "next/cache";

import {
  AuthorizationError,
  requireLessonOwnership,
} from "@/lib/auth/authorization";
import { checkUserRateLimit, rateLimitMessage } from "@/lib/auth/rate-limit-ip";
import {
  generateLessonSummary,
  isLessonSummaryConfigured,
} from "@/lib/ai/lesson-summary";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export interface AiSummaryResult {
  ok: boolean;
  message?: string;
  summary?: string;
}

export async function regenerateLessonSummary(
  lessonId: string,
): Promise<AiSummaryResult> {
  try {
    if (!isLessonSummaryConfigured()) {
      return {
        ok: false,
        message: "Résumé IA non configuré. Contactez l'administrateur.",
      };
    }

    const { userId, courseId } = await requireLessonOwnership(lessonId);

    const rl = await checkUserRateLimit({
      prefix: "ai-summary",
      userId,
      windowMs: 60 * 60 * 1000,
      max: 10,
    });
    if (!rl.ok) return { ok: false, message: rateLimitMessage(rl.resetAt) };

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        title: true,
        textContent: true,
        transcript: true,
        section: { select: { course: { select: { title: true, slug: true } } } },
      },
    });
    if (!lesson) return { ok: false, message: "Leçon introuvable." };

    // Source : on préfère textContent (édité par formateur) au transcript brut.
    const content =
      lesson.textContent && lesson.textContent.trim().length > 200
        ? lesson.textContent
        : (lesson.transcript ?? "");

    if (content.trim().length < 200) {
      return {
        ok: false,
        message:
          "Pas assez de contenu pour générer un résumé. Ajoutez du texte ou attendez la transcription Mux.",
      };
    }

    const summary = await generateLessonSummary({
      courseTitle: lesson.section.course.title,
      lessonTitle: lesson.title,
      content,
    });

    await prisma.lesson.update({
      where: { id: lessonId },
      data: { aiSummary: summary, aiSummaryUpdatedAt: new Date() },
    });

    // Rafraîchit la page de la leçon côté élève + côté formateur.
    revalidatePath(`/apprentissage/${lesson.section.course.slug}`);
    revalidatePath(`/formateur/cours/${courseId}/lecons/${lessonId}`);

    return { ok: true, summary };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, message: error.message };
    }
    logError("ai-lesson-summary", error, { lessonId });
    return { ok: false, message: "Échec de la génération du résumé." };
  }
}
