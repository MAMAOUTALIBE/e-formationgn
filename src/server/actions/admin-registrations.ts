"use server";

// Server Actions des inscriptions : rattacher un élève à une session, puis
// piloter ses accès par le statut.
//
// Aucune suppression : une inscription annulée reste consultable. C'est elle
// qui justifiera plus tard une facturation, un dossier OPCO ou une attestation.

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAnyAdminRole } from "@/lib/auth/authorization";
import { adminRolesForScreen } from "@/lib/workspace/admin-screen-roles";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";
import { syncRegistrationAccess } from "@/server/services/registration-access";

export interface RegistrationActionResult {
  success: boolean;
  message?: string;
}

const registerSchema = z
  .object({
    sessionId: z.string().trim().min(1),
    studentId: z.string().trim().min(1),
  })
  .strict();

/** Statuts qui ouvrent les accès — doit rester aligné sur le service. */
const STATUS_LABEL: Record<string, string> = {
  PENDING: "en attente",
  ACTIVE: "active",
  SUSPENDED: "suspendue",
  COMPLETED: "terminée",
  CANCELLED: "annulée",
};

export async function registerStudentToSession(
  sessionId: string,
  studentId: string,
): Promise<RegistrationActionResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole(...adminRolesForScreen("/admin/utilisateurs"));
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  const parsed = registerSchema.safeParse({ sessionId, studentId });
  if (!parsed.success) return { success: false, message: "Paramètres invalides." };

  const [session, student] = await Promise.all([
    prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        capacity: true,
        reference: true,
        program: { select: { title: true } },
        _count: { select: { registrations: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, email: true, role: true, companyId: true },
    }),
  ]);

  if (!session) return { success: false, message: "Session introuvable." };
  if (!student) return { success: false, message: "Élève introuvable." };
  if (student.role !== "STUDENT") {
    return { success: false, message: "Seul un compte élève peut être inscrit." };
  }
  if (session.status === "CANCELLED") {
    return { success: false, message: "Cette session est annulée." };
  }
  // La capacité n'est pas décorative : elle correspond à une salle, un
  // formateur, un financement. On refuse plutôt que de laisser déborder.
  if (session.capacity !== null && session._count.registrations >= session.capacity) {
    return { success: false, message: `Session complète (${session.capacity} places).` };
  }

  const existing = await prisma.registration.findUnique({
    where: { studentId_sessionId: { studentId, sessionId } },
    select: { id: true, status: true },
  });
  if (existing) {
    return {
      success: false,
      message: `Cet élève est déjà inscrit à cette session (${STATUS_LABEL[existing.status] ?? existing.status}).`,
    };
  }

  const registration = await prisma.registration.create({
    data: { studentId, sessionId, status: "PENDING" },
  });

  await createAuditLog({
    actorId: actor.userId,
    action: "registration.create",
    targetType: "Registration",
    targetId: registration.id,
    metadata: {
      student: student.email,
      program: session.program.title,
      session: session.reference,
    },
  });

  revalidatePath(`/admin/utilisateurs/${studentId}`);
  return {
    success: true,
    message: "Inscription créée, en attente. Activez-la pour ouvrir les accès.",
  };
}

/**
 * Change le statut d'une inscription et réaligne les accès.
 *
 * C'est le seul geste des points 8 et 9 : suspendre retire réellement les
 * cours, réactiver les rend et restaure la progression.
 */
export async function setRegistrationStatus(
  registrationId: string,
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "COMPLETED" | "CANCELLED",
): Promise<RegistrationActionResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole(...adminRolesForScreen("/admin/utilisateurs"));
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      status: true,
      studentId: true,
      student: { select: { email: true } },
      session: { select: { reference: true, program: { select: { title: true } } } },
    },
  });
  if (!registration) return { success: false, message: "Inscription introuvable." };

  const now = new Date();
  await prisma.registration.update({
    where: { id: registrationId },
    data: {
      status,
      // Horodatages d'étape : ils tracent le parcours de l'inscription, ce
      // qu'un simple statut courant ne dit pas.
      activatedAt: status === "ACTIVE" ? now : undefined,
      suspendedAt: status === "SUSPENDED" ? now : undefined,
      completedAt: status === "COMPLETED" ? now : undefined,
      cancelledAt: status === "CANCELLED" ? now : undefined,
    },
  });

  // Réalignement APRÈS l'écriture du statut : le service lit l'état voulu en
  // base, il ne le déduit pas d'un paramètre.
  const sync = await syncRegistrationAccess(registrationId);

  await createAuditLog({
    actorId: actor.userId,
    action: "registration.status",
    targetType: "Registration",
    targetId: registrationId,
    metadata: {
      student: registration.student.email,
      program: registration.session.program.title,
      from: registration.status,
      to: status,
      accessGranted: sync.granted,
      accessRevoked: sync.revoked,
    },
  });

  revalidatePath(`/admin/utilisateurs/${registration.studentId}`);

  const detail =
    sync.granted > 0
      ? ` ${sync.granted} accès ouvert${sync.granted > 1 ? "s" : ""}.`
      : sync.revoked > 0
        ? ` ${sync.revoked} accès retiré${sync.revoked > 1 ? "s" : ""}.`
        : "";

  return {
    success: true,
    message: `Inscription ${STATUS_LABEL[status] ?? status}.${detail}`,
  };
}
