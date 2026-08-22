"use server";

// Quiz : éditeur formateur (CRUD questions/options) + tentatives élève.

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { validateQuizSubmission } from "@/lib/quiz-submission";
import { markLessonCompleted } from "@/server/services/lesson-completion";
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
  const { lesson } = await requireLessonOwner(lessonId);

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

  revalidateQuizEditor(lesson.section.courseId, lessonId);
  return { success: true, message: "Quiz mis à jour." };
}

export async function addQuizQuestion(
  lessonId: string,
  payload: unknown,
): Promise<ActionResult> {
  const { lesson } = await requireLessonOwner(lessonId);

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

  revalidateQuizEditor(lesson.section.courseId, lessonId);
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
  const answersCount = await prisma.quizAnswer.count({
    where: { questionId },
  });
  if (answersCount > 0) {
    return {
      success: false,
      message:
        "Cette question possède déjà des réponses d’élèves et ne peut plus être supprimée.",
    };
  }

  await prisma.quizQuestion.delete({ where: { id: questionId } });
  revalidateQuizEditor(
    question.quiz.lesson.section.courseId,
    question.quiz.lessonId,
  );
  return { success: true, message: "Question supprimée." };
}

function revalidateQuizEditor(courseId: string, lessonId: string) {
  revalidatePath(`/formateur/cours/${courseId}/programme`);
  revalidatePath(`/formateur/cours/${courseId}/lecons/${lessonId}`);
}

// ----- Côté élève : tentatives --------------------------------------------

/** Correction d'une question, renvoyée à l'élève sous conditions. */
export interface QuizQuestionReview {
  questionId: string;
  prompt: string;
  correct: boolean;
  /** Libellés que l'élève a cochés. */
  chosenLabels: string[];
  /** Libellés attendus. */
  correctLabels: string[];
  explanation: string | null;
}

export interface QuizAttemptResult {
  ok: boolean;
  attemptId?: string;
  score?: number;
  passed?: boolean;
  totalQuestions?: number;
  correctCount?: number;
  attemptsUsed?: number;
  attemptsRemaining?: number | null;
  bestScore?: number;
  lastScore?: number;
  /**
   * Correction détaillée — présente UNIQUEMENT quand le quiz est validé ou
   * quand il ne reste plus de tentative.
   *
   * La livrer après un échec rattrapable reviendrait à donner le corrigé
   * avant la reprise : l'élève rejouerait les bonnes cases sans avoir rien
   * appris, et le score cesserait de mesurer quoi que ce soit.
   */
  review?: QuizQuestionReview[];
  message?: string;
}

const ATTEMPT_LIMIT_REACHED = "ATTEMPT_LIMIT_REACHED";

function isRetryableAttemptConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
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

  const submissionValidation = validateQuizSubmission(
    quiz.questions,
    parsed.data.answers,
  );
  if (!submissionValidation.valid) {
    return { ok: false, message: submissionValidation.message };
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

  // Correction par question, calculée systématiquement mais divulguée sous
  // condition (cf. `QuizAttemptResult.review`).
  const review: QuizQuestionReview[] = quiz.questions.map((question) => {
    const correctOptionIds = correctByQuestion.get(question.id) ?? new Set<string>();
    const submitted = new Set(
      parsed.data.answers.find((a) => a.questionId === question.id)?.optionIds ?? [],
    );
    const isCorrect =
      submitted.size === correctOptionIds.size &&
      Array.from(correctOptionIds).every((id) => submitted.has(id));
    return {
      questionId: question.id,
      prompt: question.prompt,
      correct: isCorrect,
      chosenLabels: question.options
        .filter((option) => submitted.has(option.id))
        .map((option) => option.label),
      correctLabels: question.options
        .filter((option) => option.isCorrect)
        .map((option) => option.label),
      explanation: question.explanation,
    };
  });

  // Tout dans une seule transaction : QuizAttempt + QuizAnswers + (si passé)
  // marquage LessonProgress.isCompleted=true + recompute progressPercent.
  // Avant cette refonte, le upsert LessonProgress était hors transaction —
  // un crash entre les deux laissait un attempt enregistré mais la leçon non
  // complétée (et le pourcentage de progression non recalculé du tout).
  const snapshot = {
    schemaVersion: 1,
    title: quiz.title,
    passingScore: quiz.passingScore,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      explanation: question.explanation,
      kind: question.kind,
      points: question.points,
      options: question.options.map((option) => ({
        id: option.id,
        label: option.label,
        isCorrect: option.isCorrect,
      })),
    })),
  } satisfies Prisma.InputJsonValue;

  const userId = session.user.id;
  let transactionResult:
    | { attemptId: string; attemptsUsed: number; bestScore: number }
    | undefined;
  for (let transactionTry = 0; transactionTry < 3; transactionTry += 1) {
    try {
      transactionResult = await prisma.$transaction(
        async (tx) => {
          const previousAttempts = await tx.quizAttempt.findMany({
            where: { quizId, userId },
            select: { score: true, attemptNumber: true, completedAt: true },
          });
          const completedAttempts = previousAttempts.filter(
            (item) => item.completedAt !== null,
          );
          if (
            quiz.maxAttempts !== null &&
            completedAttempts.length >= quiz.maxAttempts
          ) {
            throw new Error(ATTEMPT_LIMIT_REACHED);
          }
          const attemptNumber =
            Math.max(0, ...previousAttempts.map((item) => item.attemptNumber)) + 1;
          const created = await tx.quizAttempt.create({
            data: {
              quizId,
              userId,
              score,
              passed,
              completedAt: new Date(),
              attemptNumber,
              snapshot,
            },
          });
          for (const answer of parsed.data.answers) {
            const correctSet = correctByQuestion.get(answer.questionId)!;
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

          if (passed) {
            await markLessonCompleted(
              {
                userId,
                lessonId: quiz.lessonId,
                courseId: quiz.lesson.section.courseId,
              },
              tx,
            );
          }
          return {
            attemptId: created.id,
            attemptsUsed: completedAttempts.length + 1,
            bestScore: Math.max(score, ...completedAttempts.map((item) => item.score)),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      break;
    } catch (error) {
      if (error instanceof Error && error.message === ATTEMPT_LIMIT_REACHED) {
        return { ok: false, message: "Vous avez atteint la limite de tentatives." };
      }
      if (!isRetryableAttemptConflict(error) || transactionTry === 2) throw error;
    }
  }

  if (!transactionResult) {
    return { ok: false, message: "La tentative n’a pas pu être enregistrée." };
  }

  const attemptsRemaining =
    quiz.maxAttempts === null
      ? null
      : Math.max(0, quiz.maxAttempts - transactionResult.attemptsUsed);

  revalidatePath(`/apprentissage`);
  return {
    ok: true,
    attemptId: transactionResult.attemptId,
    score,
    passed,
    totalQuestions: quiz.questions.length,
    correctCount,
    attemptsUsed: transactionResult.attemptsUsed,
    attemptsRemaining,
    bestScore: transactionResult.bestScore,
    lastScore: score,
    review: passed || attemptsRemaining === 0 ? review : undefined,
  };
}
