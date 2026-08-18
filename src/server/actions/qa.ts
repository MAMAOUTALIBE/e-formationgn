"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  checkUserRateLimit,
  rateLimitMessage,
} from "@/lib/auth/rate-limit-ip";
import { prisma } from "@/lib/prisma";
import { canAnswerQuestion } from "@/lib/qa-access";
import { answerSchema, questionSchema } from "@/lib/validators/engagement";

import type { ActionResult } from "./auth";

export async function createQuestion(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, message: "Connectez-vous." };

  const rl = await checkUserRateLimit({
    prefix: "qa:question",
    userId: session.user.id,
    windowMs: 60 * 60 * 1000,
    max: 20,
  });
  if (!rl.ok) return { success: false, message: rateLimitMessage(rl.resetAt) };

  const parsed = questionSchema.safeParse({
    courseId: formData.get("courseId"),
    lessonId: formData.get("lessonId") || undefined,
    visibility: formData.get("visibility") || "PUBLIC",
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const [enrollment, course, lesson] = await Promise.all([
    prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId: session.user.id, courseId: parsed.data.courseId },
      },
      select: { id: true },
    }),
    prisma.course.findUnique({
      where: { id: parsed.data.courseId },
      select: { slug: true, instructorId: true, title: true },
    }),
    parsed.data.lessonId
      ? prisma.lesson.findFirst({
          where: { id: parsed.data.lessonId, section: { courseId: parsed.data.courseId } },
          select: { id: true, title: true },
        })
      : Promise.resolve(null),
  ]);
  if (!enrollment) {
    return {
      success: false,
      message: "Inscrivez-vous au cours pour poser une question.",
    };
  }
  if (!course) return { success: false, message: "Cours introuvable." };
  if (parsed.data.lessonId && !lesson) {
    return { success: false, message: "Cette leçon n’appartient pas au cours." };
  }

  await prisma.$transaction(async (tx) => {
    const created = await tx.question.create({
      data: {
        courseId: parsed.data.courseId,
        lessonId: lesson?.id,
        userId: session.user.id,
        title: parsed.data.title,
        body: parsed.data.body,
        visibility: parsed.data.visibility,
      },
    });
    await tx.notification.create({
      data: {
        userId: course.instructorId,
        kind: "NEW_QUESTION",
        title: lesson
          ? `Nouvelle question sur « ${lesson.title} »`
          : "Nouvelle question sur votre cours",
        body: `${parsed.data.title} (${course.title})`,
        url: `/cours/${course.slug}/questions/${created.id}`,
      },
    });
    return created;
  });
  revalidatePath(`/cours/${course.slug}/questions`);
  if (lesson) revalidatePath(`/apprentissage/${course.slug}/lecons/${lesson.id}`);
  revalidatePath("/formateur/questions");
  return { success: true, message: "Question publiée." };
}

export async function answerQuestion(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, message: "Connectez-vous." };

  const rl = await checkUserRateLimit({
    prefix: "qa:answer",
    userId: session.user.id,
    windowMs: 60 * 60 * 1000,
    max: 60,
  });
  if (!rl.ok) return { success: false, message: rateLimitMessage(rl.resetAt) };

  const parsed = answerSchema.safeParse({
    questionId: formData.get("questionId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const question = await prisma.question.findUnique({
    where: { id: parsed.data.questionId },
    include: { course: { select: { slug: true, instructorId: true } } },
  });
  if (!question) return { success: false, message: "Question introuvable." };

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId: question.courseId,
      },
    },
    select: { id: true },
  });
  if (
    !canAnswerQuestion({
      viewerId: session.user.id,
      viewerRole: session.user.role,
      authorId: question.userId,
      instructorId: question.course.instructorId,
      visibility: question.visibility,
      isEnrolled: Boolean(enrollment),
    })
  ) {
    return { success: false, message: "Vous ne pouvez pas répondre à cette question." };
  }

  // Une réponse officielle du formateur déclenche la notification demandée.
  const isOfficialAnswer = session.user.id === question.course.instructorId;
  await prisma.$transaction(async (tx) => {
    await tx.answer.create({
      data: {
        questionId: question.id,
        userId: session.user.id,
        body: parsed.data.body,
      },
    });

    if (question.userId !== session.user.id && isOfficialAnswer) {
      await tx.notification.create({
        data: {
          userId: question.userId,
          kind: "NEW_ANSWER",
          title: "Nouvelle réponse à votre question",
          body: question.title,
          url: `/cours/${question.course.slug}/questions/${question.id}`,
        },
      });
    }
  });

  revalidatePath(`/cours/${question.course.slug}/questions/${question.id}`);
  revalidatePath(`/cours/${question.course.slug}/questions`);
  if (question.lessonId) {
    revalidatePath(`/apprentissage/${question.course.slug}/lecons/${question.lessonId}`);
  }
  revalidatePath("/formateur/questions");
  return { success: true, message: "Réponse publiée." };
}

// Marque une question comme résolue / la rouvre. Autorisé au formateur
// propriétaire du cours, à l'auteur de la question, ou à un admin.
export async function setQuestionResolved(
  questionId: string,
  resolved: boolean,
): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Connectez-vous.");

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { course: { select: { slug: true, instructorId: true } } },
  });
  if (!question) throw new Error("Question introuvable.");

  const isOwner = session.user.id === question.course.instructorId;
  const isAuthor = session.user.id === question.userId;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAuthor && !isAdmin) {
    throw new Error("Action non autorisée.");
  }

  await prisma.question.update({
    where: { id: questionId },
    data: { isResolved: resolved },
  });

  revalidatePath("/formateur/questions");
  revalidatePath(`/cours/${question.course.slug}/questions/${question.id}`);
  revalidatePath(`/cours/${question.course.slug}/questions`);
  if (question.lessonId) {
    revalidatePath(`/apprentissage/${question.course.slug}/lecons/${question.lessonId}`);
  }
}
