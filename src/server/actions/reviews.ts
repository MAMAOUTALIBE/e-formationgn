"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  checkUserRateLimit,
  rateLimitMessage,
} from "@/lib/auth/rate-limit-ip";
import { prisma } from "@/lib/prisma";
import { reviewSchema } from "@/lib/validators/engagement";

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
  const rl = checkUserRateLimit({
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

  await prisma.review.upsert({
    where: {
      userId_courseId: { userId: session.user.id, courseId: parsed.data.courseId },
    },
    update: {
      rating: parsed.data.rating,
      title: parsed.data.title ? parsed.data.title : null,
      comment: parsed.data.comment ? parsed.data.comment : null,
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
