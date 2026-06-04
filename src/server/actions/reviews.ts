"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { auth } from "@/auth";
import {
  checkUserRateLimit,
  rateLimitMessage,
} from "@/lib/auth/rate-limit-ip";
import {
  classifyReviewContent,
  isReviewModerationConfigured,
} from "@/lib/ai/review-moderation";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { reviewSchema } from "@/lib/validators/engagement";
import { createAuditLog } from "@/server/services/audit-log";

import type { ActionResult } from "./auth";

async function recomputeCourseRating(courseId: string) {
  const stats = await prisma.review.aggregate({
    where: { courseId, isPublished: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await prisma.course.update({
    where: { id: courseId },
    data: {
      averageRating: stats._avg.rating ?? 0,
      totalRatings: stats._count._all,
    },
  });
}

export async function upsertReview(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, message: "Connectez-vous pour noter ce cours." };
  }

  // Limite par couple user×course pour permettre la modification d'un avis
  // existant (upsert) sans pénaliser, mais bloquer le spam multi-cours.
  const rl = await checkUserRateLimit({
    prefix: "review:upsert",
    userId: session.user.id,
    windowMs: 24 * 60 * 60 * 1000,
    max: 30,
  });
  if (!rl.ok) return { success: false, message: rateLimitMessage(rl.resetAt) };

  const parsed = reviewSchema.safeParse({
    courseId: formData.get("courseId"),
    rating: formData.get("rating"),
    title: formData.get("title") ?? "",
    comment: formData.get("comment") ?? "",
  });
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // Doit être inscrit au cours pour pouvoir noter.
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: { userId: session.user.id, courseId: parsed.data.courseId },
    },
    select: { id: true },
  });
  if (!enrollment) {
    return {
      success: false,
      message: "Vous devez être inscrit au cours pour le noter.",
    };
  }

  const review = await prisma.review.upsert({
    where: {
      userId_courseId: { userId: session.user.id, courseId: parsed.data.courseId },
    },
    update: {
      rating: parsed.data.rating,
      title: parsed.data.title ? parsed.data.title : null,
      comment: parsed.data.comment ? parsed.data.comment : null,
      // Une nouvelle édition repasse l'avis en attente de modération auto.
      isPublished: true,
    },
    create: {
      userId: session.user.id,
      courseId: parsed.data.courseId,
      rating: parsed.data.rating,
      title: parsed.data.title ? parsed.data.title : null,
      comment: parsed.data.comment ? parsed.data.comment : null,
    },
  });

  await recomputeCourseRating(parsed.data.courseId);

  // Modération automatique en post-réponse : si le commentaire est jugé
  // suspect, on dépublie l'avis (admin peut réhabiliter via /admin/moderation).
  // Tournée via `after()` pour ne pas bloquer la réponse utilisateur.
  const commentToCheck = parsed.data.comment?.trim();
  if (
    commentToCheck &&
    commentToCheck.length >= 10 &&
    isReviewModerationConfigured()
  ) {
    after(async () => {
      try {
        const verdict = await classifyReviewContent(commentToCheck);
        if (verdict.flagged) {
          await prisma.review.update({
            where: { id: review.id },
            data: { isPublished: false },
          });
          // Recalcule le rating moyen sans cet avis.
          await recomputeCourseRating(parsed.data.courseId);
          // Trace dans l'audit log pour suivi admin.
          await createAuditLog({
            action: "review.auto_unpublished",
            targetType: "Review",
            targetId: review.id,
            metadata: {
              category: verdict.category,
              reason: verdict.reason ?? null,
              courseId: parsed.data.courseId,
            },
          });
        }
      } catch (error) {
        logError("review-moderation", error, { reviewId: review.id });
      }
    });
  }

  const course = await prisma.course.findUnique({
    where: { id: parsed.data.courseId },
    select: { slug: true, instructorId: true },
  });
  if (course) {
    revalidatePath(`/cours/${course.slug}`);
    // Notification au formateur
    await prisma.notification.create({
      data: {
        userId: course.instructorId,
        kind: "NEW_REVIEW",
        title: "Nouvel avis sur votre cours",
        body: `Un élève a laissé un avis (${parsed.data.rating}/5).`,
        url: `/cours/${course.slug}`,
      },
    });
  }
  return { success: true, message: "Merci pour votre avis !" };
}

export async function deleteReview(courseId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, message: "Connectez-vous." };
  await prisma.review.deleteMany({ where: { userId: session.user.id, courseId } });
  await recomputeCourseRating(courseId);
  return { success: true };
}

// Réponse publique du formateur à un avis. Vérifie que l'auteur est bien le
// formateur du cours (sinon refuse silencieusement). Reply vide = retire la
// réponse précédente.
export async function replyToReview(
  reviewId: string,
  reply: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, message: "Connectez-vous." };

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { courseId: true, course: { select: { instructorId: true } } },
  });
  if (!review) return { success: false, message: "Avis introuvable." };
  if (review.course.instructorId !== session.user.id) {
    return { success: false, message: "Action non autorisée." };
  }

  const trimmed = reply.trim();
  if (trimmed.length > 2000) {
    return { success: false, message: "Réponse trop longue (max 2000 caractères)." };
  }

  await prisma.review.update({
    where: { id: reviewId },
    data: {
      instructorReply: trimmed.length > 0 ? trimmed : null,
      instructorRepliedAt: trimmed.length > 0 ? new Date() : null,
    },
  });

  await createAuditLog({
    actorId: session.user.id,
    action: "instructor.review.reply",
    targetType: "Review",
    targetId: reviewId,
    metadata: { courseId: review.courseId, length: trimmed.length },
  });

  revalidatePath("/formateur/avis");
  return {
    success: true,
    message: trimmed.length > 0 ? "Réponse publiée." : "Réponse supprimée.",
  };
}

// Signalement d'un avis abusif par le formateur → trace dans l'AuditLog pour
// que la modération l'examine (pas de suppression directe par le formateur).
export async function reportReview(
  reviewId: string,
  reason: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, message: "Connectez-vous." };

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { courseId: true, course: { select: { instructorId: true } } },
  });
  if (!review) return { success: false, message: "Avis introuvable." };
  if (
    review.course.instructorId !== session.user.id &&
    session.user.role !== "ADMIN"
  ) {
    return { success: false, message: "Action non autorisée." };
  }

  await createAuditLog({
    actorId: session.user.id,
    action: "instructor.review.report",
    targetType: "Review",
    targetId: reviewId,
    metadata: { courseId: review.courseId, reason: reason.trim().slice(0, 500) },
  });

  return {
    success: true,
    message: "Avis signalé à l'équipe de modération.",
  };
}
