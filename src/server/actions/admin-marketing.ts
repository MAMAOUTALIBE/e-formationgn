"use server";

// Server Actions Marketing : campagnes email, bannières.

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendEmailCampaign } from "@/server/services/email-campaign";

import type { ActionResult } from "./auth";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Connectez-vous.");
  if (session.user.role !== "ADMIN") {
    throw new Error("Réservé à l'administrateur.");
  }
  return session.user;
}

async function audit(actorId: string, action: string, targetType: string, targetId: string) {
  await prisma.auditLog.create({
    data: { actorId, action, targetType, targetId },
  });
}

// --- Campagnes email -------------------------------------------------------

export async function createEmailTemplate(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const slug = String(formData.get("slug") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const bodyText = String(formData.get("bodyText") ?? "").trim();
  const bodyHtml = String(formData.get("bodyHtml") ?? "").trim() || `<p>${bodyText}</p>`;
  if (!slug || !name || !subject || !bodyText) {
    return { success: false, message: "Champs obligatoires manquants." };
  }
  const tpl = await prisma.emailTemplate.create({
    data: { slug, name, subject, bodyText, bodyHtml },
  });
  await audit(admin.id, "email-template.create", "EmailTemplate", tpl.id);
  revalidatePath("/admin/marketing/campagnes-email");
  return { success: true, message: "Template créé." };
}

export async function deleteEmailTemplate(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.emailTemplate.delete({ where: { id } });
  await audit(admin.id, "email-template.delete", "EmailTemplate", id);
  revalidatePath("/admin/marketing/campagnes-email");
  return { success: true };
}

export async function dispatchEmailCampaign(
  campaignId: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    const result = await sendEmailCampaign(campaignId);
    await audit(admin.id, "email-campaign.send", "EmailCampaign", campaignId);
    revalidatePath("/admin/marketing/campagnes-email");
    return {
      success: true,
      message: `Envoyé à ${result.delivered} destinataire(s) sur ${result.total} (${result.failed} échec(s)).`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Échec de l'envoi.",
    };
  }
}

export async function createEmailCampaign(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "");
  const segment = String(formData.get("segment") ?? "all");
  if (!name || !templateId) {
    return { success: false, message: "Nom et template requis." };
  }
  const c = await prisma.emailCampaign.create({
    data: {
      name,
      templateId,
      segmentDefinition: { kind: segment },
      status: "DRAFT",
    },
  });
  await audit(admin.id, "email-campaign.create", "EmailCampaign", c.id);
  revalidatePath("/admin/marketing/campagnes-email");
  return { success: true, message: "Campagne créée." };
}

// --- Bannières sitewide ----------------------------------------------------

export async function createBanner(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const message = String(formData.get("message") ?? "").trim();
  const ctaLabel = String(formData.get("ctaLabel") ?? "").trim() || null;
  const ctaUrl = String(formData.get("ctaUrl") ?? "").trim() || null;
  const kind = (String(formData.get("kind") ?? "INFO") as
    | "INFO"
    | "PROMO"
    | "WARNING");
  const isActive = formData.get("isActive") === "on";
  if (!message) return { success: false, message: "Message requis." };
  const b = await prisma.sitewideBanner.create({
    data: { message, ctaLabel, ctaUrl, kind, isActive },
  });
  await audit(admin.id, "banner.create", "SitewideBanner", b.id);
  revalidatePath("/admin/marketing/promotions");
  return { success: true, message: "Bannière créée." };
}

export async function toggleBanner(id: string, active: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.sitewideBanner.update({
    where: { id },
    data: { isActive: active },
  });
  await audit(admin.id, "banner.toggle", "SitewideBanner", id);
  revalidatePath("/admin/marketing/promotions");
  return { success: true };
}

export async function deleteBanner(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.sitewideBanner.delete({ where: { id } });
  await audit(admin.id, "banner.delete", "SitewideBanner", id);
  revalidatePath("/admin/marketing/promotions");
  return { success: true };
}
