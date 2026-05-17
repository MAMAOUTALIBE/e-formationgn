"use server";

// Server Actions admin pour la gestion des utilisateurs.
// Toutes vérifient le rôle ADMIN et loggent dans AuditLog.

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/authorization";
import { csvResponseHeaders, rowsToCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { listAdminUsers } from "@/server/queries/admin-users";

import type { ActionResult } from "./auth";

async function audit(
  actorId: string,
  action: string,
  targetId: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      targetType: "User",
      targetId,
      metadata: (metadata as never) ?? undefined,
    },
  });
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
  role: "STUDENT" | "INSTRUCTOR" | "ADMIN" | "MODERATOR" | "SUPPORT" | "FINANCE",
): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: {
      role,
      isInstructor: role === "INSTRUCTOR" || role === "ADMIN",
    },
  });
  await audit(admin.userId, "user.role-change", userId, { role });
  revalidatePath(`/admin/utilisateurs/${userId}`);
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
  try {
    await requireAdmin();
  } catch {
    return { error: "Non autorisé." };
  }
  const users = await prisma.user.findMany({
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
  return { csv: rowsToCsv(rows), filename: `users-${new Date().toISOString().slice(0, 10)}.csv` };
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
