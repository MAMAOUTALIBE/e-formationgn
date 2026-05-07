// Service d'envoi d'une campagne email.
// Étapes :
//   1) Résolution du segment → liste de destinataires
//   2) Création des EmailCampaignRecipient (idempotent par UNIQUE(campaign,user))
//   3) Envoi via Resend (en batchs de 50 — limite sage pour éviter rate limit)
//   4) Mise à jour des compteurs d'agrégation sur la campagne
//
// Le tracking ouverture/clic nécessitera un endpoint webhook Resend
// (à brancher dans une vague suivante). Pour l'instant on incrémente
// `totalDelivered` à l'envoi.

import type { Prisma } from "@/generated/prisma/client";
import { sendTransactionalEmail } from "@/lib/email/client";
import { prisma } from "@/lib/prisma";

interface SegmentDefinition {
  kind:
    | "all"
    | "students"
    | "instructors"
    | "inactive_30d"
    | "cart_abandoned";
}

async function resolveSegmentRecipients(
  definition: SegmentDefinition,
): Promise<{ id: string; email: string; name: string | null }[]> {
  const where: Prisma.UserWhereInput = {
    status: "ACTIVE",
    emailVerified: { not: null },
  };
  switch (definition.kind) {
    case "students":
      where.role = "STUDENT";
      break;
    case "instructors":
      where.isInstructor = true;
      break;
    case "inactive_30d": {
      const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      where.OR = [{ lastLoginAt: null }, { lastLoginAt: { lt: cutoff } }];
      break;
    }
    case "cart_abandoned":
      where.cartItems = {
        some: {
          addedAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) },
        },
      };
      break;
    case "all":
    default:
      break;
  }
  return prisma.user.findMany({
    where,
    select: { id: true, email: true, name: true },
    take: 5000, // garde-fou
  });
}

function applyTemplateVariables(
  body: string,
  vars: Record<string, string>,
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export interface SendCampaignResult {
  total: number;
  delivered: number;
  failed: number;
}

export async function sendEmailCampaign(
  campaignId: string,
): Promise<SendCampaignResult> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: { template: true },
  });
  if (!campaign) throw new Error("Campagne introuvable.");
  if (campaign.status === "SENT" || campaign.status === "SENDING") {
    throw new Error("Campagne déjà envoyée ou en cours d'envoi.");
  }

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: { status: "SENDING" },
  });

  let recipients: Awaited<ReturnType<typeof resolveSegmentRecipients>>;
  try {
    const segDef = (campaign.segmentDefinition as unknown as SegmentDefinition) ?? {
      kind: "all",
    };
    recipients = await resolveSegmentRecipients(segDef);
  } catch (error) {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "FAILED" },
    });
    throw error;
  }

  // Pré-création des destinataires (sauter ceux déjà inscrits si retry).
  await prisma.emailCampaignRecipient.createMany({
    data: recipients.map((r) => ({
      campaignId,
      userId: r.id,
    })),
    skipDuplicates: true,
  });

  let delivered = 0;
  let failed = 0;
  const batchSize = 50;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (r) => {
        const vars = {
          name: r.name ?? "",
          email: r.email,
        };
        const html = applyTemplateVariables(campaign.template.bodyHtml, vars);
        const text = applyTemplateVariables(campaign.template.bodyText, vars);
        const result = await sendTransactionalEmail({
          to: r.email,
          subject: campaign.template.subject,
          html,
          text,
        });
        if (result.ok) {
          delivered += 1;
          await prisma.emailCampaignRecipient.update({
            where: {
              campaignId_userId: { campaignId, userId: r.id },
            },
            data: { sentAt: new Date() },
          });
        } else {
          failed += 1;
        }
      }),
    );
  }

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      status: failed === recipients.length ? "FAILED" : "SENT",
      sentAt: new Date(),
      totalRecipients: recipients.length,
      totalDelivered: delivered,
    },
  });

  return { total: recipients.length, delivered, failed };
}
