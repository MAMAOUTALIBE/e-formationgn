"use server";

// Server Actions Sécurité : audit export, gestion sessions, IP bans, RGPD.

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isStaffRole, STAFF_ROLES } from "@/lib/account-audience";
import { requireAdmin } from "@/lib/auth/authorization";
import { hashPassword } from "@/lib/auth/password";
import { checkUserRateLimit, rateLimitMessage } from "@/lib/auth/rate-limit-ip";
import { rowsToCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";
import { generateTemporaryPassword } from "@/server/services/temporary-password";

import type { ActionResult } from "./auth";

// --- Attribution / révocation des rôles administratifs --------------------
// Réservé à l'ADMIN (requireAdmin). Journalisé. Évite de passer par du SQL
// direct pour promouvoir un MODERATOR/SUPPORT/FINANCE.

const assignRoleSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Email invalide."),
    role: z.enum(STAFF_ROLES),
  })
  .strict();

export async function assignAdminRole(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = assignRoleSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { success: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, role: true },
  });
  if (!user) {
    return { success: false, message: "Aucun compte avec cet email." };
  }
  if (user.role === parsed.data.role) {
    return { success: false, message: `Ce compte est déjà ${parsed.data.role}.` };
  }
  if (!isStaffRole(user.role)) {
    return {
      success: false,
      message:
        "Cette adresse appartient à un apprenant. Créez un compte interne séparé pour éviter de mélanger ses accès.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      role: parsed.data.role,
      isInstructor: parsed.data.role === "INSTRUCTOR",
    },
  });
  await createAuditLog({
    actorId: admin.userId,
    action: "user.role-assign",
    targetType: "User",
    targetId: user.id,
    metadata: { from: user.role, to: parsed.data.role },
  });
  revalidatePath("/admin/equipe");
  revalidatePath(`/admin/utilisateurs/${user.id}`);
  revalidatePath("/admin/formateurs");
  return {
    success: true,
    message: `Rôle ${parsed.data.role} attribué à ${parsed.data.email}.`,
  };
}

export interface CreateStaffAccountResult extends ActionResult {
  temporaryPassword?: string;
  createdEmail?: string;
  values?: Record<string, string>;
}

const createStaffAccountSchema = z
  .object({
    firstName: z.string().trim().min(1, "Prénom requis.").max(80),
    lastName: z.string().trim().min(1, "Nom requis.").max(80),
    email: z.string().trim().toLowerCase().email("Email invalide."),
    role: z.enum(STAFF_ROLES),
  })
  .strict();

export async function createStaffAccount(
  _prev: CreateStaffAccountResult,
  formData: FormData,
): Promise<CreateStaffAccountResult> {
  const admin = await requireAdmin();
  const raw = {
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? ""),
  };
  const parsed = createStaffAccountSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Formulaire incomplet. Votre saisie est conservée.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values: raw,
    };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { role: true },
  });
  if (existing) {
    return {
      success: false,
      message:
        existing.role === "STUDENT"
          ? "Cette adresse est déjà celle d’un apprenant. Utilisez une autre adresse pour le compte interne."
          : "Un compte interne utilise déjà cette adresse.",
      values: raw,
    };
  }

  const temporaryPassword = generateTemporaryPassword();
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      name: `${parsed.data.firstName} ${parsed.data.lastName}`,
      hashedPassword: await hashPassword(temporaryPassword),
      role: parsed.data.role,
      isInstructor: parsed.data.role === "INSTRUCTOR",
      status: "ACTIVE",
      emailVerified: new Date(),
      mustChangePassword: false,
    },
    select: { id: true, email: true, role: true },
  });

  await createAuditLog({
    actorId: admin.userId,
    action: "staff.create",
    targetType: "User",
    targetId: user.id,
    metadata: { email: user.email, role: user.role },
  });
  revalidatePath("/admin/equipe");
  revalidatePath("/admin/formateurs");

  return {
    success: true,
    message: "Compte interne créé.",
    temporaryPassword,
    createdEmail: user.email,
  };
}

export async function setStaffAccountStatus(
  userId: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (userId === admin.userId && status === "SUSPENDED") {
    return {
      success: false,
      message: "Vous ne pouvez pas désactiver votre propre compte.",
    };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  });
  if (!user || !isStaffRole(user.role)) {
    return { success: false, message: "Compte interne introuvable." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status,
      bannedAt: status === "ACTIVE" ? null : undefined,
      bannedReason: status === "ACTIVE" ? null : undefined,
      passwordChangedAt: status === "SUSPENDED" ? new Date() : undefined,
    },
  });
  await createAuditLog({
    actorId: admin.userId,
    action: status === "ACTIVE" ? "staff.activate" : "staff.suspend",
    targetType: "User",
    targetId: userId,
    metadata: { email: user.email, role: user.role },
  });
  revalidatePath("/admin/equipe");
  revalidatePath(`/admin/utilisateurs/${userId}`);
  return {
    success: true,
    message:
      status === "ACTIVE"
        ? `Compte interne de ${user.email} réactivé.`
        : `Compte interne de ${user.email} désactivé.`,
  };
}

/**
 * Retire des formateurs de l'espace actif sans effacer leurs formations ni
 * les pièces d'historique qui doivent rester consultables.
 *
 * Le statut DELETED coupe l'authentification dans src/auth.ts. On conserve le
 * rôle et le drapeau formateur afin que l'administration puisse retrouver ces
 * comptes avec le filtre « Archivés » et, si nécessaire, les réactiver depuis
 * leur fiche.
 */
export async function archiveInstructorAccounts(
  requestedIds: string[],
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (
    !Array.isArray(requestedIds) ||
    requestedIds.some((id) => typeof id !== "string" || id.length < 1 || id.length > 64)
  ) {
    return { success: false, message: "Sélection de formateurs invalide." };
  }

  const ids = [...new Set(requestedIds)];
  if (ids.length === 0) {
    return { success: false, message: "Aucun formateur sélectionné." };
  }
  if (ids.length > 100) {
    return { success: false, message: "Sélectionnez au maximum 100 formateurs." };
  }
  if (ids.includes(admin.userId)) {
    return { success: false, message: "Vous ne pouvez pas supprimer votre propre compte." };
  }

  const instructors = await prisma.user.findMany({
    where: {
      id: { in: ids },
      role: "INSTRUCTOR",
      isInstructor: true,
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      _count: { select: { coursesAuthored: true } },
    },
  });
  if (instructors.length !== ids.length) {
    return {
      success: false,
      message:
        "La sélection contient un compte qui n’est pas formateur. Aucune suppression n’a été appliquée.",
    };
  }

  const activeInstructors = instructors.filter((instructor) => instructor.status !== "DELETED");
  if (activeInstructors.length === 0) {
    return { success: false, message: "Ces formateurs sont déjà archivés." };
  }
  const activeIds = activeInstructors.map((instructor) => instructor.id);
  const archivedAt = new Date();

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: { in: activeIds } } }),
    prisma.user.updateMany({
      where: { id: { in: activeIds } },
      data: {
        status: "DELETED",
        passwordChangedAt: archivedAt,
      },
    }),
  ]);

  await Promise.all(
    activeInstructors.map((instructor) =>
      createAuditLog({
        actorId: admin.userId,
        action: "instructor.archive",
        targetType: "User",
        targetId: instructor.id,
        metadata: {
          email: instructor.email,
          role: instructor.role,
          coursesPreserved: instructor._count.coursesAuthored,
        },
      }),
    ),
  );

  revalidatePath("/admin/formateurs");
  revalidatePath("/admin/equipe");
  for (const id of activeIds) revalidatePath(`/admin/utilisateurs/${id}`);

  return {
    success: true,
    message: `${activeIds.length} formateur${activeIds.length > 1 ? "s" : ""} supprimé${activeIds.length > 1 ? "s" : ""} de la liste active.`,
  };
}

export async function exportAuditLogCsv(): Promise<
  { csv: string; filename: string } | { error: string }
> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { error: "Non autorisé." };
  }
  // Le journal d'audit est la pièce qu'un attaquant veut emporter en premier.
  const rl = await checkUserRateLimit({
    prefix: "admin:export:audit",
    userId: session.userId,
    windowMs: 10 * 60_000,
    max: 5,
  });
  if (!rl.ok) return { error: rateLimitMessage(rl.resetAt) };

  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: { actor: { select: { email: true, name: true } } },
  });
  const rows = entries.map((e) => ({
    createdAt: e.createdAt.toISOString(),
    actor: e.actor?.email ?? "system",
    action: e.action,
    targetType: e.targetType ?? "",
    targetId: e.targetId ?? "",
    metadata: e.metadata ? JSON.stringify(e.metadata) : "",
  }));
  // Le registre d'audit s'auto-trace : sans cette entrée, aspirer la totalité
  // du journal de traçabilité serait précisément l'acte qui n'y figure pas.
  await createAuditLog({
    actorId: session.userId,
    action: "audit.export_csv",
    targetType: "AuditLog",
    targetId: null,
    metadata: { rowCount: rows.length },
  });

  return {
    csv: rowsToCsv(rows),
    filename: `audit-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

const disconnectUserSchema = z.string().trim().min(1).max(191);

export async function disconnectUserEverywhere(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = disconnectUserSchema.safeParse(userId);
  if (!parsed.success) {
    return { success: false, message: "Identifiant utilisateur invalide." };
  }
  if (parsed.data === admin.userId) {
    return {
      success: false,
      message: "Vous ne pouvez pas déconnecter votre propre session depuis cet écran.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.data },
    select: { id: true, email: true },
  });
  if (!user) return { success: false, message: "Compte introuvable." };

  const revokedAt = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordChangedAt: revokedAt },
  });
  await createAuditLog({
    actorId: admin.userId,
    action: "user.sessions.revoke_all",
    targetType: "User",
    targetId: user.id,
    metadata: { email: user.email, revokedAt: revokedAt.toISOString(), strategy: "jwt" },
  });
  revalidatePath("/admin/securite/sessions");
  return {
    success: true,
    message: "Toutes les connexions de ce compte ont été invalidées.",
  };
}

export async function banIp(ipHash: string, reason?: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ipHash || ipHash.length < 8) {
    return { success: false, message: "ipHash invalide." };
  }
  await prisma.bannedIP.upsert({
    where: { ipHash },
    update: { reason: reason ?? null },
    create: { ipHash, reason: reason ?? null, bannedById: admin.userId },
  });
  await createAuditLog({
    actorId: admin.userId,
    action: "ip.ban",
    targetType: "IP",
    targetId: ipHash,
    metadata: reason ? { reason } : null,
  });
  revalidatePath("/admin/securite/logs");
  return { success: true, message: "IP bannie." };
}

export async function unbanIp(ipHash: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.bannedIP.deleteMany({ where: { ipHash } });
  await createAuditLog({
    actorId: admin.userId,
    action: "ip.unban",
    targetType: "IP",
    targetId: ipHash,
  });
  revalidatePath("/admin/securite/logs");
  return { success: true };
}

/**
 * Clôture manuelle d'une demande RGPD restée en attente.
 *
 * Ce bouton basculait le statut à « traité » sans qu'aucune donnée n'ait été
 * exportée ni supprimée : un administrateur de bonne foi clôturait une demande
 * d'effacement en croyant l'avoir honorée. Les deux circuits exécutent
 * désormais l'opération immédiatement (cf. `admin-users.ts`), si bien qu'une
 * demande encore en attente est nécessairement une demande dont le traitement a
 * échoué ou qui a été créée hors application.
 *
 * La clôture reste donc possible — un traitement peut avoir été mené hors
 * ligne — mais elle est explicitement marquée comme telle, pour que la trace ne
 * laisse pas croire que la plateforme a fait le travail.
 */
export async function markGdprRequestComplete(
  id: string,
  justification?: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const motif = justification?.trim();
  if (!motif || motif.length < 10) {
    return {
      success: false,
      message:
        "Indiquez comment la demande a été traitée (au moins 10 caractères). La plateforme n'a exécuté aucune opération sur cette demande.",
    };
  }
  await prisma.gdprRequest.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      metadata: {
        cloture: "manuelle",
        traitementHorsPlateforme: motif,
        clotureePar: admin.userId,
      },
    },
  });
  await createAuditLog({
    actorId: admin.userId,
    action: "gdpr.complete-manual",
    targetType: "GdprRequest",
    targetId: id,
    metadata: { justification: motif },
  });
  revalidatePath("/admin/securite/rgpd");
  return { success: true };
}
