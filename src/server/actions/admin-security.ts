"use server";

// Server Actions Sécurité : audit export, gestion sessions, IP bans, RGPD.

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/authorization";
import { checkUserRateLimit, rateLimitMessage } from "@/lib/auth/rate-limit-ip";
import { rowsToCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

import type { ActionResult } from "./auth";

// --- Attribution / révocation des rôles administratifs --------------------
// Réservé à l'ADMIN (requireAdmin). Journalisé. Évite de passer par du SQL
// direct pour promouvoir un MODERATOR/SUPPORT/FINANCE.

const ASSIGNABLE_ROLES = ["ADMIN", "MODERATOR", "SUPPORT", "FINANCE"] as const;

const assignRoleSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Email invalide."),
    role: z.enum(ASSIGNABLE_ROLES),
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

  await prisma.user.update({
    where: { id: user.id },
    // ADMIN obtient aussi les capacités formateur ; les autres rôles ne
    // touchent pas isInstructor (undefined = champ inchangé).
    data: {
      role: parsed.data.role,
      isInstructor: parsed.data.role === "ADMIN" ? true : undefined,
    },
  });
  await createAuditLog({
    actorId: admin.userId,
    action: "user.role-assign",
    targetType: "User",
    targetId: user.id,
    metadata: { from: user.role, to: parsed.data.role },
  });
  revalidatePath("/admin/securite/roles");
  return {
    success: true,
    message: `Rôle ${parsed.data.role} attribué à ${parsed.data.email}.`,
  };
}

export async function revokeAdminRole(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (userId === admin.userId) {
    return {
      success: false,
      message: "Vous ne pouvez pas révoquer votre propre rôle.",
    };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, email: true },
  });
  if (!user) return { success: false, message: "Compte introuvable." };

  await prisma.user.update({
    where: { id: userId },
    data: { role: "STUDENT", isInstructor: false },
  });
  await createAuditLog({
    actorId: admin.userId,
    action: "user.role-revoke",
    targetType: "User",
    targetId: userId,
    metadata: { from: user.role },
  });
  revalidatePath("/admin/securite/roles");
  return { success: true, message: `Rôle de ${user.email} révoqué (→ STUDENT).` };
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

export async function markGdprRequestComplete(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.gdprRequest.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  await createAuditLog({
    actorId: admin.userId,
    action: "gdpr.complete",
    targetType: "GdprRequest",
    targetId: id,
  });
  revalidatePath("/admin/securite/rgpd");
  return { success: true };
}
