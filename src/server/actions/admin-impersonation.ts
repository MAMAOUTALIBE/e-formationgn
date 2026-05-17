"use server";

// Démarre / arrête une session d'impersonation admin.
// Toute action est loggée dans `AuditLog` + `ImpersonationSession`.

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { requireAdmin } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";
import {
  clearImpersonation,
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
  const admin = await requireAdminUser();
  if (admin.userId === targetUserId) {
    return { success: false, message: "Impossible de s'impersonner soi-même." };
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, role: true },
  });
  if (!target) return { success: false, message: "Utilisateur introuvable." };

  const sessionRecord = await prisma.impersonationSession.create({
    data: {
      adminId: admin.userId,
      targetUserId: target.id,
      reason: reason ?? null,
    },
  });

  await writeImpersonation({
    sessionId: sessionRecord.id,
    targetUserId: target.id,
  });

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

  await prisma.impersonationSession.update({
    where: { id: cookie.sessionId },
    data: { endedAt: new Date() },
  });
  await clearImpersonation();

  await createAuditLog({
    actorId: session.user.id,
    action: "admin.impersonation.stop",
    targetType: "User",
    targetId: cookie.targetUserId,
  });

  revalidatePath("/admin");
  return { success: true, message: "Impersonation arrêtée." };
}
