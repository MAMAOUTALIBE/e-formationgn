"use server";

// Server Action : génération assistée des champs SEO d'un cours.
// Réservée au formateur propriétaire (ou admin). Rate-limit dur (5/h)
// pour limiter le coût Claude.

import {
  AuthorizationError,
  requireCourseOwnership,
} from "@/lib/auth/authorization";
import { checkUserRateLimit, rateLimitMessage } from "@/lib/auth/rate-limit-ip";
import {
  generateSeoSuggestions,
  isSeoAiConfigured,
  type SeoSuggestion,
} from "@/lib/ai/seo-suggestions";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export interface AiSeoResult {
  ok: boolean;
  message?: string;
  suggestion?: SeoSuggestion;
}

export async function suggestSeoForCourse(
  courseId: string,
): Promise<AiSeoResult> {
  try {
    if (!isSeoAiConfigured()) {
      return {
        ok: false,
        message: "Suggestions IA non configurées. Contactez l'administrateur.",
      };
    }

    const { userId } = await requireCourseOwnership(courseId);

    // Rate-limit utilisateur : 5 suggestions/h pour limiter le coût.
    const rl = await checkUserRateLimit({
      prefix: "ai-seo",
      userId,
      windowMs: 60 * 60 * 1000,
      max: 5,
    });
    if (!rl.ok) return { ok: false, message: rateLimitMessage(rl.resetAt) };

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        title: true,
        subtitle: true,
        description: true,
        level: true,
        category: { select: { name: true } },
      },
    });
    if (!course) return { ok: false, message: "Formation introuvable." };

    if (course.description.trim().length < 80) {
      return {
        ok: false,
        message:
          "La description de la formation est trop courte (≥ 80 caractères) pour générer des suggestions de qualité.",
      };
    }

    const suggestion = await generateSeoSuggestions({
      title: course.title,
      subtitle: course.subtitle ?? undefined,
      description: course.description,
      categoryName: course.category?.name,
      level: course.level,
    });

    return { ok: true, suggestion };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, message: error.message };
    }
    logError("ai-seo", error, { courseId });
    return {
      ok: false,
      message:
        "Échec de la génération. Réessayez dans un instant ou rédigez manuellement.",
    };
  }
}
