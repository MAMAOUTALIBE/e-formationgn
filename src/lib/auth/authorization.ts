import "server-only";

// Helpers d'autorisation centralisés. Toute Server Action / route qui doit
// vérifier l'identité, le rôle ou la propriété d'une ressource passe par ici.
//
// Pourquoi : le pattern requireSession + requireRole + requireOwnership était
// dupliqué dans 6 fichiers (curriculum, instructor, admin, qa, learning,
// reviews) avec des variantes subtiles. Un seul endroit, un seul comportement.

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  isAdminRole,
  isInstructorOrAdmin,
  type AdminRole,
} from "@/lib/constants";
import type { LessonType, UserRole } from "@/generated/prisma/enums";

export class AuthorizationError extends Error {
  readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND";

  constructor(
    code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

export interface SessionContext {
  userId: string;
  email: string;
  role: UserRole;
}

// ---------------------------------------------------------------------------
// Authentification
// ---------------------------------------------------------------------------

/**
 * Renvoie la session connectée. Throw si anonyme.
 * Utilisé en début de Server Action quand on a besoin du userId.
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthorizationError(
      "UNAUTHENTICATED",
      "Vous devez être connecté.",
    );
  }
  return {
    userId: session.user.id,
    email: session.user.email,
    role: session.user.role,
  };
}

// ---------------------------------------------------------------------------
// Rôles
// ---------------------------------------------------------------------------

/** Exige un rôle ADMIN strict (pas de sous-rôle CRM). */
export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.role !== "ADMIN") {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Réservé aux administrateurs.",
    );
  }
  return ctx;
}

/**
 * Exige un rôle parmi ADMIN, MODERATOR, SUPPORT, FINANCE — la route handler
 * peut ensuite filtrer plus finement (FINANCE n'a pas accès aux outils de
 * modération par exemple).
 */
export async function requireAnyAdminRole(
  ...allowed: AdminRole[]
): Promise<SessionContext> {
  const ctx = await requireSession();
  if (!isAdminRole(ctx.role)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Réservé à l'équipe administrative.",
    );
  }
  if (allowed.length > 0 && !(allowed as readonly string[]).includes(ctx.role)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Vous n'avez pas les droits pour cette action.",
    );
  }
  return ctx;
}

/** Exige INSTRUCTOR ou ADMIN. Utilisé par tout l'espace formateur. */
export async function requireInstructorOrAdmin(): Promise<
  SessionContext & { isAdmin: boolean }
> {
  const ctx = await requireSession();
  if (!isInstructorOrAdmin(ctx.role)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Réservé aux formateurs.",
    );
  }
  return { ...ctx, isAdmin: ctx.role === "ADMIN" };
}

// ---------------------------------------------------------------------------
// Propriété de ressource
// ---------------------------------------------------------------------------

export interface CourseOwnershipResult {
  course: { id: string; instructorId: string };
  userId: string;
  isAdmin: boolean;
}

/**
 * Vérifie qu'un cours existe et que l'utilisateur courant en est le
 * propriétaire (ou ADMIN). Throw NOT_FOUND si le cours n'existe pas, FORBIDDEN
 * si l'utilisateur n'a pas les droits.
 */
export async function requireCourseOwnership(
  courseId: string,
): Promise<CourseOwnershipResult> {
  const ctx = await requireInstructorOrAdmin();
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, instructorId: true },
  });
  if (!course) {
    throw new AuthorizationError("NOT_FOUND", "Formation introuvable.");
  }
  if (!ctx.isAdmin && course.instructorId !== ctx.userId) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Vous n'êtes pas le propriétaire de cette formation.",
    );
  }
  return { course, userId: ctx.userId, isAdmin: ctx.isAdmin };
}

export interface SectionOwnershipResult {
  section: { id: string; courseId: string };
  userId: string;
  isAdmin: boolean;
}

export async function requireSectionOwnership(
  sectionId: string,
): Promise<SectionOwnershipResult> {
  const ctx = await requireInstructorOrAdmin();
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: {
      id: true,
      courseId: true,
      course: { select: { instructorId: true } },
    },
  });
  if (!section) {
    throw new AuthorizationError("NOT_FOUND", "Section introuvable.");
  }
  if (!ctx.isAdmin && section.course.instructorId !== ctx.userId) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Vous n'êtes pas le propriétaire de cette section.",
    );
  }
  return {
    section: { id: section.id, courseId: section.courseId },
    userId: ctx.userId,
    isAdmin: ctx.isAdmin,
  };
}

export interface LessonOwnershipResult {
  lesson: {
    id: string;
    sectionId: string;
    type: LessonType;
    muxAssetId: string | null;
  };
  courseId: string;
  userId: string;
  isAdmin: boolean;
}

export async function requireLessonOwnership(
  lessonId: string,
): Promise<LessonOwnershipResult> {
  const ctx = await requireInstructorOrAdmin();
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      sectionId: true,
      type: true,
      muxAssetId: true,
      section: {
        select: {
          courseId: true,
          course: { select: { instructorId: true } },
        },
      },
    },
  });
  if (!lesson) {
    throw new AuthorizationError("NOT_FOUND", "Leçon introuvable.");
  }
  if (!ctx.isAdmin && lesson.section.course.instructorId !== ctx.userId) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Vous n'êtes pas le propriétaire de cette leçon.",
    );
  }
  return {
    lesson: {
      id: lesson.id,
      sectionId: lesson.sectionId,
      type: lesson.type,
      muxAssetId: lesson.muxAssetId,
    },
    courseId: lesson.section.courseId,
    userId: ctx.userId,
    isAdmin: ctx.isAdmin,
  };
}

export interface EnrollmentContext {
  enrollment: { id: string; courseId: string; userId: string };
  userId: string;
}

/**
 * Vérifie qu'un utilisateur est inscrit (Enrollment) à un cours donné.
 * Renvoie l'enrollment + l'userId. Throw FORBIDDEN si pas inscrit, NOT_FOUND
 * si le cours n'existe pas dans la table Enrollment pour cet utilisateur.
 *
 * À utiliser par toutes les Server Actions « réservées aux inscrits » :
 * tutor.askLessonTutor, qa.createQuestion, reviews.upsertReview,
 * learning.markLessonComplete, quiz.submitQuizAttempt, certificates.issue, etc.
 */
export async function requireCourseEnrollment(
  courseId: string,
): Promise<EnrollmentContext> {
  const { userId } = await requireSession();
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true, courseId: true, userId: true },
  });
  if (!enrollment) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Vous devez être inscrit à cette formation pour effectuer cette action.",
    );
  }
  return { enrollment, userId };
}

// ---------------------------------------------------------------------------
// Conversion Error → ActionResult
// ---------------------------------------------------------------------------

/**
 * Helper pour Server Actions qui retournent un ActionResult :
 * try { ... } catch (e) { return toActionResult(e); }
 */
export function toActionResult(error: unknown): {
  success: false;
  message: string;
} {
  if (error instanceof AuthorizationError) {
    return { success: false, message: error.message };
  }
  if (error instanceof Error) {
    return { success: false, message: error.message };
  }
  return { success: false, message: "Erreur inattendue." };
}
