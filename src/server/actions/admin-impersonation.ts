"use server";

// Démarre / arrête une session d'impersonation admin.
// Toute action est loggée dans `AuditLog` + `ImpersonationSession`.

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  clearImpersonation,
  readImpersonation,
  writeImpersonation,
} from "@/lib/admin/impersonation";

import type { ActionResult } from "./auth";

async function requireAdminUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Connectez-vous.");
  if (session.user.role !== "ADMIN") {
    throw new Error("Réservé à l'administrateur.");
  }
  return session.user;
}

export async function startImpersonation(
  targetUserId: string,
  reason?: string,
): Promise<ActionResult> {
  const admin = await requireAdminUser();
  if (admin.id === targetUserId) {
    return { success: false, message: "Impossible de s'impersonner soi-même." };
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, role: true },
  });
  if (!target) return { success: false, message: "Utilisateur introuvable." };

  const sessionRecord = await prisma.impersonationSession.create({
    data: {
      adminId: admin.id,
      targetUserId: target.id,
      reason: reason ?? null,
    },
  });

  await writeImpersonation({
    sessionId: sessionRecord.id,
    targetUserId: target.id,
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "admin.impersonation.start",
      targetType: "User",
      targetId: target.id,
      metadata: { reason: reason ?? null, email: target.email },
    },
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

  await prisma.impersonationSession.update({
    where: { id: cookie.sessionId },
    data: { endedAt: new Date() },
  });
  await clearImpersonation();

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "admin.impersonation.stop",
      targetType: "User",
      targetId: cookie.targetUserId,
    },
  });

  revalidatePath("/admin");
  return { success: true, message: "Impersonation arrêtée." };
}
