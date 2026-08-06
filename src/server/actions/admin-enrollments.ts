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
