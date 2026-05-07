"use server";

// Server Actions Sécurité : audit export, gestion sessions, IP bans, RGPD.

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { rowsToCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

import type { ActionResult } from "./auth";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Connectez-vous.");
  if (session.user.role !== "ADMIN") {
    throw new Error("Réservé à l'administrateur.");
  }
  return session.user;
}

export async function exportAuditLogCsv(): Promise<
  { csv: string; filename: string } | { error: string }
> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Non autorisé." };
  }
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
  return {
    csv: rowsToCsv(rows),
    filename: `audit-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

export async function revokeSession(sessionId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.session.delete({ where: { id: sessionId } });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "session.revoke",
      targetType: "Session",
      targetId: sessionId,
    },
  });
  revalidatePath("/admin/securite/sessions");
  return { success: true, message: "Session révoquée." };
}

export async function banIp(ipHash: string, reason?: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ipHash || ipHash.length < 8) {
    return { success: false, message: "ipHash invalide." };
  }
  await prisma.bannedIP.upsert({
    where: { ipHash },
    update: { reason: reason ?? null },
    create: { ipHash, reason: reason ?? null, bannedById: admin.id },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "ip.ban",
      targetType: "IP",
      targetId: ipHash,
      metadata: reason ? { reason } : undefined,
    },
  });
  revalidatePath("/admin/securite/logs");
  return { success: true, message: "IP bannie." };
}

export async function unbanIp(ipHash: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.bannedIP.deleteMany({ where: { ipHash } });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "ip.unban",
      targetType: "IP",
      targetId: ipHash,
    },
  });
  revalidatePath("/admin/securite/logs");
  return { success: true };
}

export async function markGdprRequestComplete(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.gdprRequest.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "gdpr.complete",
      targetType: "GdprRequest",
      targetId: id,
    },
  });
  revalidatePath("/admin/securite/rgpd");
  return { success: true };
}
