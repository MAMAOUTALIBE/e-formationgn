// Queries de l'espace apprenant — vérifient toujours l'inscription au cours.

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const LEARNING_COURSE_INCLUDE = {
  instructor: {
    select: { id: true, name: true, firstName: true, lastName: true, image: true, headline: true },
  },
  category: { select: { slug: true, name: true } },
  sections: {
    orderBy: { displayOrder: "asc" },
    include: {
      lessons: {
        orderBy: { displayOrder: "asc" },
        include: { resources: { orderBy: { createdAt: "asc" } } },
      },
    },
  },
} satisfies Prisma.CourseInclude;

export type LearningCourse = Prisma.CourseGetPayload<{
  include: typeof LEARNING_COURSE_INCLUDE;
}>;

interface LearningEnrollmentSummary {
  id: string;
  enrolledAt: Date;
  completedAt: Date | null;
  user: {
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}

export async function getLearningCourse(
  userId: string,
  slug: string,
): Promise<{
  course: LearningCourse;
  enrollmentId: string;
  enrollment: LearningEnrollmentSummary;
} | null> {
  const course = await prisma.course.findUnique({
    where: { slug },
    include: LEARNING_COURSE_INCLUDE,
  });
  if (!course) return null;
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    select: {
      id: true,
      enrolledAt: true,
      completedAt: true,
      user: {
        select: { name: true, firstName: true, lastName: true },
      },
    },
  });
  if (!enrollment) return null;
  return {
    course: course as LearningCourse,
    enrollmentId: enrollment.id,
    enrollment,
  };
}

export async function getLessonProgress(userId: string, courseId: string) {
  return prisma.lessonProgress.findMany({
    where: { userId, lesson: { section: { courseId } } },
    select: {
      lessonId: true,
      isCompleted: true,
      lastPositionSeconds: true,
      watchedSeconds: true,
      completedAt: true,
    },
  });
}

export async function getLessonNotes(userId: string, lessonId: string) {
  return prisma.lessonNote.findMany({
    where: { userId, lessonId },
    orderBy: [{ videoTimestampSeconds: "asc" }, { createdAt: "asc" }],
  });
}

export async function isLessonBookmarked(
  userId: string,
  lessonId: string,
): Promise<boolean> {
  const bm = await prisma.lessonBookmark.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: { id: true },
  });
  return Boolean(bm);
}

export async function listCourseAnnouncements(courseId: string) {
  return prisma.courseAnnouncement.findMany({
    where: { courseId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      author: {
        select: { id: true, name: true, firstName: true, lastName: true, image: true },
      },
    },
  });
}

export async function getCourseReviewsForLearner(courseId: string, take = 20) {
  const [reviews, course] = await Promise.all([
    prisma.review.findMany({
      where: { courseId, isPublished: true },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        user: { select: { id: true, name: true, firstName: true, image: true } },
      },
    }),
    prisma.course.findUnique({
      where: { id: courseId },
      select: { averageRating: true, totalRatings: true },
    }),
  ]);
  return {
    reviews,
    averageRating: course?.averageRating ?? 0,
    totalRatings: course?.totalRatings ?? 0,
  };
}

export async function getMyReviewForCourse(userId: string, courseId: string) {
  return prisma.review.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { rating: true, title: true, comment: true },
  });
}

export async function listLessonQuestions(
  userId: string,
  courseId: string,
  lessonId: string,
) {
  return prisma.question.findMany({
    where: {
      courseId,
      OR: [
        { visibility: "PUBLIC", lessonId },
        { visibility: "PUBLIC", lessonId: null },
        { visibility: "PRIVATE", userId, lessonId },
        { visibility: "PRIVATE", userId, lessonId: null },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { id: true, name: true, firstName: true, image: true } },
      lesson: { select: { id: true, title: true } },
      answers: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { id: true, name: true, firstName: true, image: true } },
        },
      },
    },
  });
}

export async function getLessonForLearner(
  userId: string,
  lessonId: string,
): Promise<{
  lesson: Prisma.LessonGetPayload<{
    include: { section: { include: { course: true } } };
  }>;
  enrolled: boolean;
} | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { section: { include: { course: true } } },
  });
  if (!lesson) return null;

  if (lesson.isFreePreview) return { lesson, enrolled: false };

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: lesson.section.courseId } },
    select: { id: true },
  });
  return { lesson, enrolled: Boolean(enrollment) };
}

export async function getQuizForLearner(quizId: string, userId: string) {
  // On ne renvoie pas la flag isCorrect des options à l'élève — il pourrait
  // sinon lire la réponse dans le payload réseau.
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          prompt: true,
          kind: true,
          imageUrl: true,
          imageAlt: true,
          interactionConfig: true,
          displayOrder: true,
          points: true,
          options: {
            orderBy: { displayOrder: "asc" },
            select: {
              id: true,
              label: true,
              imageUrl: true,
              imageAlt: true,
              displayOrder: true,
            },
          },
        },
      },
      attempts: {
        where: { userId, completedAt: { not: null } },
        orderBy: { attemptNumber: "desc" },
        select: {
          id: true,
          attemptNumber: true,
          score: true,
          passed: true,
          completedAt: true,
        },
      },
    },
  });
  if (!quiz) return null;
  const attemptsUsed = quiz.attempts.length;
  return {
    ...quiz,
    attemptSummary: {
      attemptsUsed,
      attemptsRemaining:
        quiz.maxAttempts === null
          ? null
          : Math.max(0, quiz.maxAttempts - attemptsUsed),
      bestScore:
        attemptsUsed === 0
          ? null
          : Math.max(...quiz.attempts.map((attempt) => attempt.score)),
      lastScore: quiz.attempts[0]?.score ?? null,
    },
  };
}

export async function getQuizForInstructor(quizId: string) {
  return prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { displayOrder: "asc" },
        include: {
          options: { orderBy: { displayOrder: "asc" } },
        },
      },
    },
  });
}

export async function getCertificateForUser(userId: string, courseId: string) {
  return prisma.certificate.findFirst({
    where: { userId, courseId },
    orderBy: { issuedAt: "desc" },
    // La session porte les dates et le lieu de l'action de formation, que
    // l'attestation doit citer (art. L.6353-1 du Code du travail).
    include: {
      registration: {
        select: {
          session: { select: { startDate: true, endDate: true, location: true } },
        },
      },
    },
  });
}

export interface CourseLearningStats {
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
}

export async function computeCourseProgress(
  userId: string,
  courseId: string,
): Promise<CourseLearningStats> {
  const [total, completed] = await Promise.all([
    prisma.lesson.count({
      where: { type: { not: "RESOURCE" }, section: { courseId } },
    }),
    prisma.lessonProgress.count({
      where: {
        userId,
        isCompleted: true,
        lesson: { type: { not: "RESOURCE" }, section: { courseId } },
      },
    }),
  ]);
  const progressPercent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { totalLessons: total, completedLessons: completed, progressPercent };
}
