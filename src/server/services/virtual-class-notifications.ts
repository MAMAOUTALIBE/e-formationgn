import "server-only";

import type { VirtualClassNotificationKind } from "@/generated/prisma/enums";
import { sendTransactionalEmail } from "@/lib/email/client";
import { renderBrandedEmail } from "@/lib/email/templates";
import { formatVirtualClassDate } from "@/lib/virtual-class-display";
import { prisma } from "@/lib/prisma";

const notificationKinds = {
  CONFIRMATION: "VIRTUAL_CLASS_SCHEDULED",
  UPDATED: "VIRTUAL_CLASS_UPDATED",
  CANCELLED: "VIRTUAL_CLASS_CANCELLED",
  REMINDER_24H: "VIRTUAL_CLASS_REMINDER",
  REMINDER_1H: "VIRTUAL_CLASS_REMINDER",
  REMINDER_15M: "VIRTUAL_CLASS_REMINDER",
  REPLAY_AVAILABLE: "VIRTUAL_CLASS_REPLAY_AVAILABLE",
} as const;

const titles: Record<VirtualClassNotificationKind, string> = {
  CONFIRMATION: "Classe virtuelle programmée",
  UPDATED: "Classe virtuelle mise à jour",
  CANCELLED: "Classe virtuelle annulée",
  REMINDER_24H: "Votre classe virtuelle commence demain",
  REMINDER_1H: "Votre classe virtuelle commence dans 1 heure",
  REMINDER_15M: "Votre classe virtuelle commence bientôt",
  REPLAY_AVAILABLE: "Le replay est disponible",
};

export async function notifyVirtualClass(input: {
  virtualClassId: string;
  kind: VirtualClassNotificationKind;
  keySuffix: string;
  scheduledFor?: Date;
}) {
  const virtualClass = await prisma.virtualClassSession.findUnique({
    where: { id: input.virtualClassId },
    select: {
      id: true, title: true, startsAt: true, timezone: true, instructorId: true, cancellationReason: true,
      trainingSession: { select: { registrations: { where: { status: "ACTIVE" }, select: { studentId: true } } } },
    },
  });
  if (!virtualClass) return { sent: 0 };
  const recipients = [...new Set([virtualClass.instructorId, ...virtualClass.trainingSession.registrations.map((item) => item.studentId)])];
  const title = titles[input.kind];
  const url = `/classes-virtuelles/${virtualClass.id}`;
  const date = formatVirtualClassDate(virtualClass.startsAt, virtualClass.timezone);
  const body = input.kind === "CANCELLED"
    ? `La séance « ${virtualClass.title} » a été annulée.${virtualClass.cancellationReason ? ` Motif : ${virtualClass.cancellationReason}` : ""}`
    : input.kind === "REPLAY_AVAILABLE"
      ? `Le replay de « ${virtualClass.title} » est maintenant disponible.`
      : `${virtualClass.title} · ${date}`;
  let sent = 0;
  for (const userId of recipients) {
    const idempotencyKey = `${virtualClass.id}:${input.kind}:${input.keySuffix}:${userId}`;
    try {
      await prisma.$transaction([
        prisma.virtualClassNotificationDelivery.create({ data: { idempotencyKey, virtualClassId: virtualClass.id, userId, kind: input.kind, scheduledFor: input.scheduledFor } }),
        prisma.notification.create({ data: { userId, kind: notificationKinds[input.kind], title, body, url } }),
      ]);
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
    sent++;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const email = renderBrandedEmail({ preview: title, heading: title, body: `<p>${body}</p>`, ctaLabel: "Voir la classe virtuelle", ctaUrl: `${appUrl}${url}` });
      await sendTransactionalEmail({ to: user.email, subject: title, ...email });
    }
  }
  return { sent };
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}
