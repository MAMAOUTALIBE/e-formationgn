"use server";

// Démarre / arrête une session d'impersonation admin.
// Toute action est loggée dans `AuditLog` + `ImpersonationSession`.

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import {
  clearImpersonation,
  IMPERSONATION_MAX_AGE_MS,
  readImpersonation,
  writeImpersonation,
} from "@/lib/admin/impersonation";
import { createAuditLog } from "@/server/services/audit-log";

import type { ActionResult } from "./auth";

const requireAdminUser = () => requireAdmin();

export async function startImpersonation(
  targetUserId: string,
  reason?: string,
): Promise<ActionResult> {
  const currentSession = await auth();
  if (currentSession?.impersonation) {
    return {
      success: false,
      message: "Quittez l'impersonation en cours avant d'en démarrer une autre.",
    };
  }
  const admin = await requireAdminUser();
  if (admin.userId === targetUserId) {
    return { success: false, message: "Impossible de s'impersonner soi-même." };
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, role: true, status: true },
  });
  if (!target) return { success: false, message: "Utilisateur introuvable." };
  if (target.status !== "ACTIVE") {
    return {
      success: false,
      message: "Seul un compte actif peut être impersonné.",
    };
  }

  const sessionRecord = await prisma.impersonationSession.create({
    data: {
      adminId: admin.userId,
      targetUserId: target.id,
      reason: reason ?? null,
    },
  });

  await writeImpersonation({ sessionId: sessionRecord.id });

  await createAuditLog({
    actorId: admin.userId,
    action: "admin.impersonation.start",
    targetType: "User",
    targetId: target.id,
    metadata: { reason: reason ?? null, email: target.email },
  });

  revalidatePath("/admin");
  return { success: true, message: "Impersonation activée." };
}

export async function stopImpersonation(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { success: false, message: "Non connecté." };

  const cookie = await readImpersonation();
  if (!cookie) {
    return { success: true, message: "Aucune impersonation active." };
  }

  const realAdminId =
    session.impersonation?.adminId ??
    (session.user.role === "ADMIN" ? session.user.id : null);
  if (!realAdminId) {
    await clearImpersonation();
    return { success: false, message: "Session d'impersonation invalide." };
  }

  const record = await prisma.impersonationSession.findFirst({
    where: {
      id: cookie.sessionId,
      adminId: realAdminId,
      endedAt: null,
      startedAt: { gte: new Date(Date.now() - IMPERSONATION_MAX_AGE_MS) },
    },
    select: { id: true, adminId: true, targetUserId: true },
  });
  if (!record) {
    await clearImpersonation();
    return { success: true, message: "Aucune impersonation active." };
  }

  await prisma.impersonationSession.updateMany({
    where: { id: record.id, adminId: record.adminId, endedAt: null },
    data: { endedAt: new Date() },
  });
  await clearImpersonation();

  await createAuditLog({
    actorId: record.adminId,
    action: "admin.impersonation.stop",
    targetType: "User",
    targetId: record.targetUserId,
    metadata: { sessionRecordId: record.id },
  });

  revalidatePath("/admin");
  return { success: true, message: "Impersonation arrêtée." };
}
