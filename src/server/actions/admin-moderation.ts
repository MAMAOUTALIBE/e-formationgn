"use server";

// Server Actions Modération : signalements, règles, contrôle des avis/Q&A.

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type {
  ModerationRuleAction,
  ModerationRuleKind,
  ReportStatus,
} from "@/generated/prisma/enums";

import type { ActionResult } from "./auth";

async function requireModerator() {
  const session = await auth();
  if (!session?.user) throw new Error("Connectez-vous.");
  if (
    session.user.role !== "ADMIN" &&
    session.user.role !== "MODERATOR"
  ) {
    throw new Error("Réservé aux admins/modérateurs.");
  }
  return session.user;
}

async function audit(actorId: string, action: string, targetType: string, targetId: string, metadata?: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      targetType,
      targetId,
      metadata: (metadata as never) ?? undefined,
    },
  });
}

export async function resolveReport(
  reportId: string,
  resolution: ReportStatus,
  notes?: string,
): Promise<ActionResult> {
  const user = await requireModerator();
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, targetType: true, targetId: true },
  });
  if (!report) return { success: false, message: "Signalement introuvable." };

  await prisma.report.update({
    where: { id: reportId },
    data: {
      status: resolution,
      notes: notes ?? null,
      resolvedAt: new Date(),
    },
  });

  // Application de l'action sur la cible si nécessaire
  if (resolution === "RESOLVED_HIDDEN" || resolution === "RESOLVED_DELETED") {
    await applyTargetAction(report.targetType, report.targetId, resolution);
  }

  await audit(user.id, "report.resolve", "Report", reportId, { resolution });
  revalidatePath("/admin/moderation/signalements");
  return { success: true, message: "Signalement traité." };
}

async function applyTargetAction(
  targetType: string,
  targetId: string,
  resolution: ReportStatus,
) {
  // RESOLVED_HIDDEN : on cache (isPublished=false sur Review, par ex)
  // RESOLVED_DELETED : suppression réelle
  if (targetType === "REVIEW") {
    if (resolution === "RESOLVED_DELETED") {
      await prisma.review.delete({ where: { id: targetId } }).catch(() => null);
    } else {
      await prisma.review
        .update({ where: { id: targetId }, data: { isPublished: false } })
        .catch(() => null);
    }
  } else if (targetType === "QUESTION" && resolution === "RESOLVED_DELETED") {
    await prisma.question.delete({ where: { id: targetId } }).catch(() => null);
  } else if (targetType === "ANSWER" && resolution === "RESOLVED_DELETED") {
    await prisma.answer.delete({ where: { id: targetId } }).catch(() => null);
  }
}

export async function createModerationRule(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModerator();
  const name = String(formData.get("name") ?? "").trim();
  const kind = (String(formData.get("kind") ?? "KEYWORD") as ModerationRuleKind);
  const pattern = String(formData.get("pattern") ?? "").trim();
  const action = (String(formData.get("action") ?? "FLAG") as ModerationRuleAction);
  if (!name || !pattern) {
    return { success: false, message: "Nom et pattern requis." };
  }
  const rule = await prisma.moderationRule.create({
    data: { name, kind, pattern, action, isActive: true },
  });
  await audit(user.id, "moderation-rule.create", "ModerationRule", rule.id);
  revalidatePath("/admin/moderation/regles");
  return { success: true, message: "Règle créée." };
}

export async function toggleModerationRule(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const user = await requireModerator();
  await prisma.moderationRule.update({
    where: { id },
    data: { isActive: active },
  });
  await audit(user.id, "moderation-rule.toggle", "ModerationRule", id);
  revalidatePath("/admin/moderation/regles");
  return { success: true };
}

export async function deleteModerationRule(id: string): Promise<ActionResult> {
  const user = await requireModerator();
  await prisma.moderationRule.delete({ where: { id } });
  await audit(user.id, "moderation-rule.delete", "ModerationRule", id);
  revalidatePath("/admin/moderation/regles");
  return { success: true };
}
