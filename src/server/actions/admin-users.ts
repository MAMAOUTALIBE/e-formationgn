"use server";

// Server Actions admin pour la gestion des utilisateurs.
// Toutes vérifient le rôle ADMIN et loggent dans AuditLog.

import type { UserRole } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";

import { isStaffRole } from "@/lib/account-audience";
import { requireAdmin } from "@/lib/auth/authorization";
import { checkUserRateLimit, rateLimitMessage } from "@/lib/auth/rate-limit-ip";
import { csvResponseHeaders, rowsToCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { listAdminUsers } from "@/server/queries/admin-users";
import { createAuditLog } from "@/server/services/audit-log";

import type { ActionResult } from "./auth";

async function audit(
  actorId: string,
  action: string,
  targetId: string,
  metadata?: Record<string, unknown>,
) {
  await createAuditLog({
    actorId,
    action,
    targetType: "User",
    targetId,
    metadata: metadata ?? null,
  });
}

async function learnerIdsOrError(
  requestedIds: string[],
): Promise<{ ids: string[] } | { error: string }> {
  const ids = [...new Set(requestedIds)].slice(0, 100);
  if (ids.length === 0) return { error: "Aucun apprenant sélectionné." };

  const learners = await prisma.user.findMany({
    where: { id: { in: ids }, role: "STUDENT" },
    select: { id: true },
  });
  if (learners.length !== ids.length) {
    return {
      error:
        "La sélection contient un compte interne. Aucune modification n’a été appliquée.",
    };
  }
  return { ids: learners.map((learner) => learner.id) };
}

export async function suspendUser(userId: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED" },
  });
  await audit(admin.userId, "user.suspend", userId, { reason });
  revalidatePath(`/admin/utilisateurs/${userId}`);
  return { success: true, message: "Utilisateur suspendu." };
}

export async function reactivateUser(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { status: "ACTIVE", bannedAt: null, bannedReason: null },
  });
  await audit(admin.userId, "user.reactivate", userId);
  revalidatePath(`/admin/utilisateurs/${userId}`);
  return { success: true, message: "Compte réactivé." };
}

export async function bulkSetUserState(
  userIds: string[],
  state: "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETED",
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const targets = await learnerIdsOrError(userIds);
  if ("error" in targets) return { success: false, message: targets.error };
  const { ids } = targets;
  const data = state === "BANNED"
    ? { status: "SUSPENDED" as const, bannedAt: new Date(), bannedReason: "Action groupée administrateur" }
    : state === "ACTIVE"
      ? { status: "ACTIVE" as const, bannedAt: null, bannedReason: null }
      : { status: state };
  await prisma.user.updateMany({ where: { id: { in: ids } }, data });
  await Promise.all(ids.map((id) => audit(admin.userId, `user.bulk-${state.toLowerCase()}`, id)));
  revalidatePath("/admin/utilisateurs");
  return { success: true, message: `${ids.length} compte${ids.length > 1 ? "s" : ""} mis à jour.` };
}

export async function bulkAssignCompany(userIds: string[], companyId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!companyId) return { success: false, message: "Sélection et société requises." };
  const targets = await learnerIdsOrError(userIds);
  if ("error" in targets) return { success: false, message: targets.error };
  const { ids } = targets;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, status: true } });
  if (!company || company.status === "ARCHIVED") return { success: false, message: "Société invalide ou archivée." };
  await prisma.user.updateMany({ where: { id: { in: ids } }, data: { companyId } });
  await Promise.all(ids.map((id) => audit(admin.userId, "user.assign-company", id, { companyId })));
  revalidatePath("/admin/utilisateurs");
  return { success: true, message: `${ids.length} compte${ids.length > 1 ? "s" : ""} affecté${ids.length > 1 ? "s" : ""}.` };
}

export async function exportSelectedUsersCsv(userIds: string[]): Promise<{ csv: string; filename: string } | { error: string }> {
  try { await requireAdmin(); } catch { return { error: "Non autorisé." }; }
  const targets = await learnerIdsOrError(userIds);
  if ("error" in targets) return targets;
  const users = await prisma.user.findMany({ where: { id: { in: targets.ids }, role: "STUDENT" }, select: { id: true, name: true, email: true, role: true, status: true, country: true, createdAt: true } });
  return {
    csv: rowsToCsv(users.map((user) => ({ ...user, name: user.name ?? "", country: user.country ?? "", createdAt: user.createdAt.toISOString() }))),
    filename: `apprenants-selection-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

export async function banUser(userId: string, reason: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "SUSPENDED",
      bannedAt: new Date(),
      bannedReason: reason,
    },
  });
  await audit(admin.userId, "user.ban", userId, { reason });
  revalidatePath(`/admin/utilisateurs/${userId}`);
  return { success: true, message: "Utilisateur banni." };
}

export async function forceVerifyEmail(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerified: new Date(),
      status: "ACTIVE",
    },
  });
  await audit(admin.userId, "user.verify-email", userId);
  revalidatePath(`/admin/utilisateurs/${userId}`);
  return { success: true, message: "Email vérifié." };
}

export async function changeUserRole(
  userId: string,
  role: UserRole,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (userId === admin.userId) {
    return { success: false, message: "Vous ne pouvez pas modifier votre propre rôle." };
  }
  if (!isStaffRole(role)) {
    return {
      success: false,
      message: "Un compte interne ne peut pas être transformé en apprenant.",
    };
  }
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!target || !isStaffRole(target.role)) {
    return {
      success: false,
      message:
        "Ce compte est un apprenant. Créez un compte interne séparé pour lui attribuer un rôle.",
    };
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      role,
      isInstructor: role === "INSTRUCTOR",
    },
  });
  await audit(admin.userId, "user.role-change", userId, { role });
  revalidatePath("/admin/equipe");
  revalidatePath(`/admin/utilisateurs/${userId}`);
  revalidatePath("/admin/formateurs");
  return { success: true, message: "Rôle modifié." };
}

export async function addAdminNoteOnUser(
  userId: string,
  body: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (body.trim().length < 2) {
    return { success: false, message: "Note trop courte." };
  }
  await prisma.adminNote.create({
    data: { targetType: "USER", targetId: userId, body, authorId: admin.userId },
  });
  await audit(admin.userId, "user.note", userId);
  revalidatePath(`/admin/utilisateurs/${userId}`);
  return { success: true, message: "Note enregistrée." };
}

export async function exportUsersCsv(): Promise<{ csv: string; filename: string } | { error: string }> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { error: "Non autorisé." };
  }
  // Export de masse de données personnelles : plafonné pour qu'une session
  // admin compromise ne puisse pas aspirer le fichier en boucle.
  const rl = await checkUserRateLimit({
    prefix: "admin:export:users",
    userId: session.userId,
    windowMs: 10 * 60_000,
    max: 5,
  });
  if (!rl.ok) return { error: rateLimitMessage(rl.resetAt) };

  const users = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      country: true,
      isInstructor: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });
  const rows = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name ?? "",
    role: u.role,
    status: u.status,
    country: u.country ?? "",
    isInstructor: u.isInstructor ? "oui" : "non",
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? "",
  }));
  // Export de masse de données personnelles : tracé au même titre qu'une
  // mutation. Sans cette entrée, une exfiltration du fichier utilisateurs ne
  // laisserait aucune trace dans AuditLog.
  await createAuditLog({
    actorId: session.userId,
    action: "user.export_csv",
    targetType: "User",
    targetId: null,
    metadata: { rowCount: rows.length },
  });

  return { csv: rowsToCsv(rows), filename: `apprenants-${new Date().toISOString().slice(0, 10)}.csv` };
}

// Garde csvResponseHeaders pour les éventuelles routes /api d'export.
export { csvResponseHeaders };

// Re-export pour usage dans la page liste.
export { listAdminUsers };

// --- RGPD : export & suppression définitive --------------------------------

export async function exportUserGdprData(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.gdprRequest.create({
    data: { userId, kind: "EXPORT", status: "PENDING" },
  });
  await audit(admin.userId, "user.gdpr-export-request", userId);
  revalidatePath(`/admin/utilisateurs/${userId}`);
  return { success: true, message: "Demande d'export RGPD enregistrée." };
}

export async function deleteUserGdpr(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  // On ne supprime PAS immédiatement : on enregistre une demande à
  // exécuter par un job (préserve l'historique et permet l'annulation).
  await prisma.gdprRequest.create({
    data: { userId, kind: "DELETE", status: "PENDING" },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { status: "DELETED" },
  });
  await audit(admin.userId, "user.gdpr-delete-request", userId);
  revalidatePath("/admin/utilisateurs");
  return { success: true, message: "Demande de suppression RGPD enregistrée." };
}
