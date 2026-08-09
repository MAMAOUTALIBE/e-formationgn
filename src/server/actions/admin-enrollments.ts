"use server";

// Attribution de formations par le centre.
//
// L'élève voit tout le catalogue mais ne peut suivre que les formations qui
// lui ont été attribuées : l'accès à /apprentissage est conditionné à
// l'existence d'une ligne Enrollment (cf. src/server/queries/learning.ts).
// Ces actions créent et retirent cette ligne, avec la source ADMIN_GRANT qui
// existait déjà dans le schéma mais que rien n'utilisait — seuls Stripe et le
// tunnel de commande créaient des inscriptions jusqu'ici.

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

import type { ActionResult } from "./auth";

const grantSchema = z
  .object({
    userId: z.string().min(1),
    courseIds: z.array(z.string().min(1)).min(1, "Sélectionnez au moins une formation."),
  })
  .strict();

/** Attribue une ou plusieurs formations à un compte. */
export async function grantCourseAccess(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { success: false, message: "Non autorisé." };
  }

  const parsed = grantSchema.safeParse({
    userId: formData.get("userId"),
    courseIds: formData.getAll("courseIds").map(String),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: "Sélectionnez au moins une formation.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { userId, courseIds } = parsed.data;

  const [user, courses] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }),
    prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, title: true },
    }),
  ]);

  if (!user) return { success: false, message: "Compte introuvable." };
  if (courses.length === 0) return { success: false, message: "Formation introuvable." };

  // `createMany` + `skipDuplicates` : réattribuer une formation déjà accordée
  // ne doit ni échouer ni réinitialiser la progression de l'élève.
  const result = await prisma.enrollment.createMany({
    data: courses.map((c) => ({
      userId,
      courseId: c.id,
      source: "ADMIN_GRANT" as const,
    })),
    skipDuplicates: true,
  });

  await createAuditLog({
    actorId: session.userId,
    action: "enrollment.grant",
    targetType: "User",
    targetId: userId,
    metadata: {
      email: user.email,
      courses: courses.map((c) => c.title),
      granted: result.count,
    },
  });

  revalidatePath(`/admin/utilisateurs/${userId}`);

  return {
    success: true,
    message:
      result.count === 0
        ? "Ces formations étaient déjà attribuées."
        : `${result.count} formation${result.count > 1 ? "s" : ""} attribuée${result.count > 1 ? "s" : ""}.`,
  };
}

/** Retire l'accès à une formation. */
export async function revokeCourseAccess(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { success: false, message: "Non autorisé." };
  }

  const userId = String(formData.get("userId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  if (!userId || !courseId) return { success: false, message: "Paramètres manquants." };

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true, source: true, course: { select: { title: true } } },
  });
  if (!enrollment) return { success: false, message: "Cet accès n'existe pas." };

  // Garde-fou : une inscription issue d'un achat correspond à une commande
  // payée. La retirer ici créerait une incohérence comptable silencieuse —
  // ce cas relève d'un remboursement, pas d'un retrait d'accès.
  if (enrollment.source === "PURCHASE") {
    return {
      success: false,
      message:
        "Cet accès provient d'un achat : passez par un remboursement plutôt que par un retrait d'accès.",
    };
  }

  await prisma.enrollment.delete({ where: { id: enrollment.id } });

  await createAuditLog({
    actorId: session.userId,
    action: "enrollment.revoke",
    targetType: "User",
    targetId: userId,
    metadata: { courseId, courseTitle: enrollment.course.title },
  });

  revalidatePath(`/admin/utilisateurs/${userId}`);

  return { success: true, message: "Accès retiré." };
}

const grantToUsersSchema = z
  .object({
    courseId: z.string().min(1),
    userIds: z.array(z.string().min(1)).min(1, "Sélectionnez au moins un compte."),
  })
  .strict();

const grantCandidatesPageSchema = z
  .object({
    courseId: z.string().min(1),
    query: z.string().trim().max(100).default(""),
    offset: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict();

export interface CourseGrantCandidatePage {
  success: boolean;
  candidates: Array<{
    id: string;
    name: string;
    email: string;
    alreadyEnrolled: boolean;
  }>;
  total: number;
  message?: string;
}

/** Recherche et pagination serveur des comptes ouvrables à une formation. */
export async function loadCourseGrantCandidates(input: {
  courseId: string;
  query?: string;
  offset?: number;
  limit?: number;
}): Promise<CourseGrantCandidatePage> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, candidates: [], total: 0, message: "Non autorisé." };
  }

  const parsed = grantCandidatesPageSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, candidates: [], total: 0, message: "Recherche invalide." };
  }

  const { courseId, query, offset, limit } = parsed.data;
  const where: Prisma.UserWhereInput = {
    status: "ACTIVE",
    role: { in: ["STUDENT", "INSTRUCTOR"] },
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { email: "asc" }],
      skip: offset,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        enrollments: {
          where: { courseId },
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    success: true,
    total,
    candidates: rows.map((user) => ({
      id: user.id,
      name: user.name ?? user.email,
      email: user.email,
      alreadyEnrolled: user.enrollments.length > 0,
    })),
  };
}

/**
 * Attribue UNE formation à plusieurs comptes — le geste inverse du précédent.
 *
 * C'est la façon naturelle d'ouvrir une formation à toute une promotion :
 * partir de la formation plutôt que de rouvrir chaque fiche élève.
 */
export async function grantCourseToUsers(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { success: false, message: "Non autorisé." };
  }

  const parsed = grantToUsersSchema.safeParse({
    courseId: formData.get("courseId"),
    userIds: formData.getAll("userIds").map(String),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: "Sélectionnez au moins un compte.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { courseId, userIds } = parsed.data;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, status: true },
  });
  if (!course) return { success: false, message: "Formation introuvable." };

  // Attribuer un brouillon donnerait accès à un contenu incomplet, sans que
  // l'élève comprenne pourquoi le programme est vide.
  if (course.status !== "PUBLISHED") {
    return {
      success: false,
      message: "Publiez d'abord cette formation avant de l'attribuer.",
    };
  }

  // On restreint aux comptes réellement existants : un identifiant fabriqué
  // ferait échouer tout le lot sur la contrainte de clé étrangère.
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true },
  });
  if (users.length === 0) return { success: false, message: "Aucun compte valide." };

  const result = await prisma.enrollment.createMany({
    data: users.map((u) => ({
      userId: u.id,
      courseId: course.id,
      source: "ADMIN_GRANT" as const,
    })),
    skipDuplicates: true,
  });

  await createAuditLog({
    actorId: session.userId,
    action: "enrollment.grant_bulk",
    targetType: "Course",
    targetId: course.id,
    metadata: {
      courseTitle: course.title,
      requested: users.length,
      granted: result.count,
    },
  });

  revalidatePath(`/admin/cours/${course.id}`);

  return {
    success: true,
    message:
      result.count === 0
        ? "Ces comptes avaient déjà accès à cette formation."
        : `Formation ouverte à ${result.count} compte${result.count > 1 ? "s" : ""}.`,
  };
}
