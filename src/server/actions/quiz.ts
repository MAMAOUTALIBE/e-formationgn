"use server";

// Quiz : éditeur formateur (CRUD questions/options) + tentatives élève.

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  quizAttemptSubmitSchema,
  quizMetaSchema,
  quizQuestionSchema,
} from "@/lib/validators/learning";

import type { ActionResult } from "./auth";

async function requireLessonOwner(lessonId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Connectez-vous.");
  const isAdmin = session.user.role === "ADMIN";
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { section: { include: { course: true } } },
  });
  if (!lesson) throw new Error("Leçon introuvable.");
  if (!isAdmin && lesson.section.course.instructorId !== session.user.id) {
    throw new Error("Action non autorisée.");
  }
  return { lesson, userId: session.user.id, isAdmin };
}

// ----- Côté formateur : créer/MAJ le quiz d'une leçon ---------------------

export async function ensureQuizForLesson(lessonId: string): Promise<string> {
  const { lesson } = await requireLessonOwner(lessonId);

  const existing = await prisma.quiz.findUnique({
    where: { lessonId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const quiz = await prisma.quiz.create({
    data: {
      lessonId,
      title: lesson.title,
      passingScore: 70,
    },
    select: { id: true },
  });
  return quiz.id;
}

export async function updateQuizMeta(
  lessonId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireLessonOwner(lessonId);

  const parsed = quizMetaSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    passingScore: formData.get("passingScore"),
    maxAttempts: formData.get("maxAttempts") ?? "",
  });
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await prisma.quiz.upsert({
    where: { lessonId },
    update: {
      title: parsed.data.title,
      description: parsed.data.description ? parsed.data.description : null,
      passingScore: parsed.data.passingScore,
      maxAttempts:
        parsed.data.maxAttempts === undefined ||
        parsed.data.maxAttempts === ""
          ? null
          : Number(parsed.data.maxAttempts),
    },
    create: {
      lessonId,
      title: parsed.data.title,
      description: parsed.data.description ? parsed.data.description : null,
      passingScore: parsed.data.passingScore,
      maxAttempts:
        parsed.data.maxAttempts === undefined ||
        parsed.data.maxAttempts === ""
          ? null
          : Number(parsed.data.maxAttempts),
    },
  });

  return { success: true, message: "Quiz mis à jour." };
}

export async function addQuizQuestion(
  lessonId: string,
  payload: unknown,
): Promise<ActionResult> {
  await requireLessonOwner(lessonId);

  const parsed = quizQuestionSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const quizId = await ensureQuizForLesson(lessonId);
  const lastOrder = await prisma.quizQuestion.aggregate({
    where: { quizId },
    _max: { displayOrder: true },
  });

  await prisma.quizQuestion.create({
    data: {
      quizId,
      prompt: parsed.data.prompt,
      explanation: parsed.data.explanation ? parsed.data.explanation : null,
      kind: parsed.data.kind,
      points: parsed.data.points,
      displayOrder: (lastOrder._max.displayOrder ?? -1) + 1,
      options: {
        create: parsed.data.options.map((option, index) => ({
          label: option.label,
          isCorrect: option.isCorrect,
          displayOrder: index,
        })),
      },
    },
  });

  return { success: true, message: "Question ajoutée." };
}

export async function deleteQuizQuestion(
  questionId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, message: "Connectez-vous." };
  const isAdmin = session.user.role === "ADMIN";

  const question = await prisma.quizQuestion.findUnique({
    where: { id: questionId },
    include: {
      quiz: {
        include: {
          lesson: { include: { section: { include: { course: true } } } },
        },
      },
    },
  });
  if (!question) return { success: false, message: "Question introuvable." };
  if (!isAdmin && question.quiz.lesson.section.course.instructorId !== session.user.id) {
    return { success: false, message: "Action non autorisée." };
  }
  await prisma.quizQuestion.delete({ where: { id: questionId } });
  return { success: true, message: "Question supprimée." };
}

// ----- Côté élève : tentatives --------------------------------------------

export interface QuizAttemptResult {
  ok: boolean;
  attemptId?: string;
  score?: number;
  passed?: boolean;
  totalQuestions?: number;
  correctCount?: number;
  message?: string;
}

export async function submitQuizAttempt(
  quizId: string,
  payload: unknown,
): Promise<QuizAttemptResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: "Connectez-vous." };

  const parsed = quizAttemptSubmitSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "Réponses invalides." };

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: { include: { options: true } },
      lesson: { include: { section: true } },
    },
  });
  if (!quiz) return { ok: false, message: "Quiz introuvable." };

  // Vérifie que l'élève est inscrit au cours
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: session.user.id,
        courseId: quiz.lesson.section.courseId,
      },
    },
    select: { id: true },
  });
  if (!enrollment) return { ok: false, message: "Inscription requise." };

  // Limite éventuelle de tentatives
  if (quiz.maxAttempts !== null) {
    const attempts = await prisma.quizAttempt.count({
      where: { quizId, userId: session.user.id, completedAt: { not: null } },
    });
    if (attempts >= quiz.maxAttempts) {
      return {
        ok: false,
        message: "Vous avez atteint la limite de tentatives.",
      };
    }
  }

  // Index des options correctes (côté serveur uniquement)
  const correctByQuestion = new Map<string, Set<string>>();
  for (const question of quiz.questions) {
    correctByQuestion.set(
      question.id,
      new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id)),
    );
  }

  // Score
  let totalPoints = 0;
  let earnedPoints = 0;
  let correctCount = 0;
  for (const question of quiz.questions) {
    totalPoints += question.points;
    const correctOptionIds = correctByQuestion.get(question.id) ?? new Set<string>();
    const submitted =
      parsed.data.answers.find((a) => a.questionId === question.id)?.optionIds ?? [];
    const submittedSet = new Set(submitted);

    const exactlyCorrect =
      submittedSet.size === correctOptionIds.size &&
      Array.from(correctOptionIds).every((id) => submittedSet.has(id));

    if (exactlyCorrect) {
      earnedPoints += question.points;
      correctCount += 1;
    }
  }
  const score =
    totalPoints === 0 ? 0 : Math.round((earnedPoints / totalPoints) * 100);
  const passed = score >= quiz.passingScore;

  const attempt = await prisma.$transaction(async (tx) => {
    const created = await tx.quizAttempt.create({
      data: {
        quizId,
        userId: session.user!.id,
        score,
        passed,
        completedAt: new Date(),
      },
    });
    for (const answer of parsed.data.answers) {
      const correctSet = correctByQuestion.get(answer.questionId);
      if (!correctSet) continue;
      // On stocke un row par option choisie ; pour les SINGLE_CHOICE/TRUE_FALSE
      // le tableau a 0 ou 1 élément.
      if (answer.optionIds.length === 0) {
        await tx.quizAnswer.create({
          data: {
            attemptId: created.id,
            questionId: answer.questionId,
            optionId: null,
            isCorrect: false,
          },
        });
      } else {
        for (const optionId of answer.optionIds) {
          await tx.quizAnswer.create({
            data: {
              attemptId: created.id,
              questionId: answer.questionId,
              optionId,
              isCorrect: correctSet.has(optionId),
            },
          });
        }
      }
    }
    return created;
  });

  // Mark lesson as complete on pass
  if (passed) {
    await prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: { userId: session.user.id, lessonId: quiz.lessonId },
      },
      update: { isCompleted: true, completedAt: new Date() },
      create: {
        userId: session.user.id,
        lessonId: quiz.lessonId,
        isCompleted: true,
        completedAt: new Date(),
      },
    });
  }

  revalidatePath(`/apprentissage`);
  return {
    ok: true,
    attemptId: attempt.id,
    score,
    passed,
    totalQuestions: quiz.questions.length,
    correctCount,
  };
}
