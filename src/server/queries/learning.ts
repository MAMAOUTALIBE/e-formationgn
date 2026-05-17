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
      },
    },
  },
} satisfies Prisma.CourseInclude;

export type LearningCourse = Prisma.CourseGetPayload<{
  include: typeof LEARNING_COURSE_INCLUDE;
}>;

export async function getLearningCourse(
  userId: string,
  slug: string,
): Promise<{ course: LearningCourse; enrollmentId: string } | null> {
  const course = await prisma.course.findUnique({
    where: { slug },
    include: LEARNING_COURSE_INCLUDE,
  });
  if (!course) return null;
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId: course.id } },
    select: { id: true },
  });
  if (!enrollment) return null;
  return { course: course as LearningCourse, enrollmentId: enrollment.id };
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

export async function getQuizForLearner(quizId: string) {
  // On ne renvoie pas la flag isCorrect des options à l'élève — il pourrait
  // sinon lire la réponse dans le payload réseau.
  return prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { displayOrder: "asc" },
        include: {
          options: {
            orderBy: { displayOrder: "asc" },
            select: { id: true, label: true, displayOrder: true },
          },
        },
      },
    },
  });
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
    prisma.lesson.count({ where: { section: { courseId } } }),
    prisma.lessonProgress.count({
      where: { userId, isCompleted: true, lesson: { section: { courseId } } },
    }),
  ]);
  const progressPercent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { totalLessons: total, completedLessons: completed, progressPercent };
}
