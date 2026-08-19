// Finalisation d'une commande Stripe — extrait du webhook handler pour être
// réutilisable depuis le cron de réconciliation (/api/cron/reconcile-orders).
//
// Idempotent : si l'Order est déjà PAID, retourne immédiatement (no-op).
// L'idempotency est protégée par :
//   - check `order.status === "PAID"` (ligne de défense rapide)
//   - upsert sur Enrollment (`userId_courseId` unique)
//   - idempotencyKey sur stripe.transfers.create (clef par order × instructor)
//
// Appelable depuis :
//   - le webhook checkout.session.completed (chemin nominal)
//   - le cron reconciliation (Order PENDING avec session Stripe payée)

import "server-only";
import type Stripe from "stripe";

import { sendTransactionalEmail } from "@/lib/email/client";
import { renderBrandedEmail } from "@/lib/email/templates";
import { logError, logWarning } from "@/lib/logger";
import { formatPriceFromCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export interface FinalizeResult {
  ok: boolean;
  /** "already_paid" si l'Order était déjà PAID (no-op idempotent). */
  reason?: "already_paid" | "order_not_found" | "finalized";
}

export async function finalizeStripeOrder(
  stripe: Stripe,
  orderId: string,
  paymentIntentId: string | null,
): Promise<FinalizeResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          course: { select: { id: true, title: true, instructorId: true } },
        },
      },
      user: {
        select: { id: true, email: true, firstName: true, name: true },
      },
    },
  });
  if (!order) {
    logWarning("stripe-finalize", "order introuvable", { orderId });
    return { ok: false, reason: "order_not_found" };
  }
  if (order.status === "PAID") {
    return { ok: true, reason: "already_paid" };
  }

  // Receipt URL via la première charge (best-effort)
  let receiptUrl: string | null = null;
  if (paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge"],
      });
      const charge = pi.latest_charge as Stripe.Charge | null;
      receiptUrl = charge?.receipt_url ?? null;
    } catch {
      /* ignore */
    }
  }

  // Transaction : update Order + create Enrollments + supprimer le panier
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
        stripeReceiptUrl: receiptUrl,
      },
    });

    for (const item of order.items) {
      await tx.enrollment.upsert({
        where: {
          userId_courseId: { userId: order.userId, courseId: item.courseId },
        },
        update: { orderItemId: item.id, source: "PURCHASE" },
        create: {
          userId: order.userId,
          courseId: item.courseId,
          orderItemId: item.id,
          source: "PURCHASE",
        },
      });

      await tx.course.update({
        where: { id: item.courseId },
        data: { totalEnrollments: { increment: 1 } },
      });
    }

    if (order.promoCodeId) {
      await tx.promoCode.update({
        where: { id: order.promoCodeId },
        data: { usedCount: { increment: 1 } },
      });
    }

    await tx.cartItem.deleteMany({ where: { userId: order.userId } });
  });

  // Notification de vente au(x) formateur(s) — best-effort, ne bloque jamais
  // le fulfillment. Idempotent de fait : on ne passe ici qu'au 1er finalize
  // (les ré-appels sortent plus haut via le garde status === "PAID").
  try {
    const salesByInstructor = new Map<string, { count: number; title: string }>();
    for (const item of order.items) {
      const id = item.course.instructorId;
      const cur = salesByInstructor.get(id);
      if (cur) cur.count += 1;
      else salesByInstructor.set(id, { count: 1, title: item.course.title });
    }
    await prisma.notification.createMany({
      data: [...salesByInstructor.entries()].map(([instructorId, info]) => ({
        userId: instructorId,
        kind: "GENERIC" as const,
        title: info.count > 1 ? `${info.count} nouvelles ventes 🎉` : "Nouvelle vente 🎉",
        body:
          info.count > 1
            ? `${info.count} de vos formations viennent d'être achetées.`
            : `Votre formation « ${info.title} » vient d'être achetée.`,
        url: "/formateur/paiements",
      })),
    });
  } catch (err) {
    logWarning("stripe-finalize", "notif vente formateur échouée (ignorée)", {
      orderId: order.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Transfers vers les comptes connectés — best-effort, idempotent.
  const payoutsByInstructor = new Map<string, number>();
  for (const item of order.items) {
    const instructorId = item.course.instructorId;
    payoutsByInstructor.set(
      instructorId,
      (payoutsByInstructor.get(instructorId) ?? 0) + item.instructorPayoutCents,
    );
  }

  for (const [instructorId, amountCents] of payoutsByInstructor) {
    if (amountCents <= 0) continue;
    const instructor = await prisma.user.findUnique({
      where: { id: instructorId },
      select: { stripeAccountId: true, stripeOnboardingDone: true },
    });
    if (!instructor?.stripeAccountId || !instructor.stripeOnboardingDone) {
      logWarning(
        "stripe-finalize",
        "formateur sans compte Connect prêt — transfer reporté",
        { instructorId, orderId: order.id, amountCents },
      );
      continue;
    }

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: amountCents,
          currency: order.currency.toLowerCase(),
          destination: instructor.stripeAccountId,
          source_transaction: paymentIntentId
            ? ((await getChargeForPI(stripe, paymentIntentId)) ?? undefined)
            : undefined,
          metadata: { orderId: order.id, instructorId },
        },
        { idempotencyKey: `order_${order.id}_inst_${instructorId}` },
      );

      const items = order.items.filter((i) => i.course.instructorId === instructorId);
      for (const item of items) {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { stripeTransferId: transfer.id },
        });
      }
    } catch (error) {
      logError("stripe-finalize", error, {
        operation: "transfer",
        instructorId,
        orderId: order.id,
        amountCents,
      });
    }
  }

  // Email de confirmation — best-effort, n'échoue pas le call si l'envoi rate.
  if (order.user.email) {
    try {
      const itemsList = order.items
        .map((i) => `• ${i.course.title}`)
        .join("<br />");
      const { html, text } = renderBrandedEmail({
        preview: "Confirmation de votre commande Gandal",
        heading: "Merci pour votre commande",
        body: `<p style="margin:0 0 12px 0;">Bonjour ${order.user.firstName ?? ""},</p>
               <p style="margin:0 0 12px 0;">Votre paiement de <strong>${formatPriceFromCents(order.totalCents, order.currency)}</strong> a bien été enregistré.</p>
               <p style="margin:0 0 12px 0;">Formations auxquelles vous êtes désormais inscrit·e :</p>
               <p style="margin:0 0 12px 0;">${itemsList}</p>`,
        ctaLabel: "Accéder à mes formations",
        ctaUrl: `${APP_URL}/apprentissage`,
      });
      await sendTransactionalEmail({
        to: order.user.email,
        subject: "Confirmation de commande — Gandal",
        html,
        text,
      });
    } catch (error) {
      logError("stripe-finalize", error, {
        operation: "confirmation-email",
        orderId: order.id,
      });
    }
  }

  return { ok: true, reason: "finalized" };
}

async function getChargeForPI(stripe: Stripe, paymentIntentId: string) {
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const charge = pi.latest_charge as Stripe.Charge | string | null;
    return typeof charge === "string" ? charge : (charge?.id ?? null);
  } catch {
    return null;
  }
}
