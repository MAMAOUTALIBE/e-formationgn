// Webhook Stripe — finalise les commandes après paiement.
//
// Évènements traités :
//   - `checkout.session.completed`        : marque l'Order PAID, crée les
//     Enrollments et déclenche les Transfers vers les comptes connectés
//     des formateurs.
//   - `payment_intent.payment_failed`     : marque l'Order FAILED.
//   - `charge.refunded`                   : marque l'Order REFUNDED ou
//     PARTIALLY_REFUNDED selon le montant.
//
// La signature est vérifiée avec STRIPE_WEBHOOK_SECRET. Idempotent : on ne
// traite chaque session qu'une seule fois (`paidAt` non null = traité).

import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { sendTransactionalEmail } from "@/lib/email/client";
import { renderBrandedEmail } from "@/lib/email/templates";
import { logError, logWarning } from "@/lib/logger";
import { formatPriceFromCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  getStripeClient,
  STRIPE_WEBHOOK_SECRET,
  isStripeConfigured,
} from "@/lib/stripe";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET manquant" },
      { status: 500 },
    );
  }

  const stripe = getStripeClient();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    logWarning("stripe-webhook", "signature invalide", { error: String(error) });
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.canceled":
        await handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed":
        await handleDispute(event);
        break;

      // Stripe Connect : statut du compte formateur
      case "account.updated":
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      // Payouts Stripe Connect
      case "payout.paid":
      case "payout.failed":
        await handlePayoutEvent(event);
        break;

      default:
        // Évènements non gérés : OK 200 pour ne pas faire ré-essayer Stripe.
        break;
    }
  } catch (error) {
    logError("stripe-webhook", error, { eventType: event.type, eventId: event.id });
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// checkout.session.completed
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    logWarning("stripe-webhook", "checkout.session.completed sans orderId", {
      sessionId: session.id,
    });
    return;
  }

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
    logWarning("stripe-webhook", "order introuvable", { orderId });
    return;
  }

  // Idempotence : si déjà PAID, rien à faire.
  if (order.status === "PAID") return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  // Récupère le receipt URL via la première charge (best-effort)
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

  // Stripe Transfers vers les comptes connectés (best-effort).
  // On groupe par formateur pour limiter le nombre de transfers.
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
        "stripe-webhook",
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
            ? (await getChargeForPI(stripe, paymentIntentId)) ?? undefined
            : undefined,
          metadata: { orderId: order.id, instructorId },
        },
        // idempotence par order x instructeur
        { idempotencyKey: `order_${order.id}_inst_${instructorId}` },
      );

      // Marque les OrderItems comme transférés
      const items = order.items.filter((i) => i.course.instructorId === instructorId);
      for (const item of items) {
        await prisma.orderItem.update({
          where: { id: item.id },
          data: { stripeTransferId: transfer.id },
        });
      }
    } catch (error) {
      logError("stripe-webhook", error, {
        operation: "transfer",
        instructorId,
        orderId: order.id,
        amountCents,
      });
    }
  }

  // Email de confirmation
  if (order.user.email) {
    const itemsList = order.items
      .map((i) => `• ${i.course.title}`)
      .join("<br />");
    const { html, text } = renderBrandedEmail({
      preview: "Confirmation de votre commande E-FormationGN",
      heading: "Merci pour votre commande",
      body: `<p style="margin:0 0 12px 0;">Bonjour ${order.user.firstName ?? ""},</p>
             <p style="margin:0 0 12px 0;">Votre paiement de <strong>${formatPriceFromCents(order.totalCents, order.currency)}</strong> a bien été enregistré.</p>
             <p style="margin:0 0 12px 0;">Cours auxquels vous êtes désormais inscrit·e :</p>
             <p style="margin:0 0 12px 0;">${itemsList}</p>`,
      ctaLabel: "Accéder à mes cours",
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/apprentissage`,
    });
    await sendTransactionalEmail({
      to: order.user.email,
      subject: "Confirmation de commande — E-FormationGN",
      html,
      text,
    });
  }
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

// ---------------------------------------------------------------------------
// payment_intent.payment_failed
// ---------------------------------------------------------------------------

async function handlePaymentFailed(intent: Stripe.PaymentIntent) {
  const orderId = intent.metadata?.orderId;
  if (!orderId) return;
  await prisma.order.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "FAILED", stripePaymentIntentId: intent.id },
  });
}

// ---------------------------------------------------------------------------
// charge.refunded
// ---------------------------------------------------------------------------

async function handleChargeRefunded(charge: Stripe.Charge) {
  const intentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);
  if (!intentId) return;

  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: intentId },
  });
  if (!order) return;

  // Stripe API moderne : `charge.refunds` n'est plus expand par défaut.
  // On utilise `amount_refunded` qui est toujours présent sur le Charge,
  // sinon fallback sur `refunds.list` côté API.
  let refundedTotal = charge.amount_refunded ?? 0;
  if (!refundedTotal) {
    try {
      const refunds = await getStripeClient().refunds.list({ charge: charge.id, limit: 100 });
      refundedTotal = refunds.data.reduce((acc, r) => acc + r.amount, 0);
    } catch (error) {
      logError("stripe-webhook", error, {
        operation: "refunds.list",
        chargeId: charge.id,
        orderId: order.id,
      });
    }
  }

  const status =
    refundedTotal >= order.totalCents ? "REFUNDED" : "PARTIALLY_REFUNDED";

  await prisma.order.update({
    where: { id: order.id },
    data: { status },
  });
}

// ---------------------------------------------------------------------------
// payment_intent.canceled
// ---------------------------------------------------------------------------

async function handlePaymentCanceled(intent: Stripe.PaymentIntent) {
  const orderId = intent.metadata?.orderId;
  if (!orderId) return;
  await prisma.order.updateMany({
    where: { id: orderId, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "CANCELLED", stripePaymentIntentId: intent.id },
  });
}

// ---------------------------------------------------------------------------
// charge.dispute.* — un client conteste un paiement (Dispute Stripe)
// ---------------------------------------------------------------------------

async function handleDispute(event: Stripe.Event) {
  const dispute = event.data.object as Stripe.Dispute;
  const chargeId =
    typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
  if (!chargeId) return;

  // Retrouve l'order via la charge → PaymentIntent
  const charge = await getStripeClient().charges.retrieve(chargeId);
  const piId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);
  if (!piId) return;

  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: piId },
    select: { id: true, userId: true },
  });
  if (!order) return;

  // Mappe le status Stripe → DisputeStatus interne
  const isClosed = event.type === "charge.dispute.closed";
  const status =
    dispute.status === "won"
      ? "RESOLVED_NO_REFUND"
      : dispute.status === "lost"
        ? "RESOLVED_REFUND"
        : isClosed
          ? "RESOLVED_NO_REFUND"
          : "OPEN";

  await prisma.dispute.upsert({
    where: { id: dispute.id },
    update: {
      status,
      resolution: dispute.reason ?? null,
      resolvedAt: isClosed ? new Date() : null,
    },
    create: {
      id: dispute.id,
      orderId: order.id,
      reason: `Stripe dispute · ${dispute.reason ?? "unknown"}`,
      status,
    },
  });

  // Notifie l'admin via AuditLog
  await prisma.auditLog.create({
    data: {
      action: `stripe.dispute.${event.type.split(".").pop()}`,
      targetType: "Dispute",
      targetId: dispute.id,
      metadata: { orderId: order.id, amount: dispute.amount, reason: dispute.reason },
    },
  });
}

// ---------------------------------------------------------------------------
// account.updated — Stripe Connect onboarding du formateur
// ---------------------------------------------------------------------------

async function handleAccountUpdated(account: Stripe.Account) {
  const accountId = account.id;
  if (!accountId) return;

  const onboardingDone =
    account.details_submitted === true &&
    account.charges_enabled === true &&
    account.payouts_enabled === true;

  await prisma.user.updateMany({
    where: { stripeAccountId: accountId },
    data: {
      stripeAccountStatus: onboardingDone ? "active" : (account.requirements?.disabled_reason ?? "pending"),
      stripeOnboardingDone: onboardingDone,
    },
  });
}

// ---------------------------------------------------------------------------
// payout.paid / payout.failed — sur compte Connect formateur
// ---------------------------------------------------------------------------

async function handlePayoutEvent(event: Stripe.Event) {
  const payout = event.data.object as Stripe.Payout;
  if (!payout.id) return;

  const status = event.type === "payout.paid" ? "PAID" : "FAILED";
  await prisma.payout.updateMany({
    where: { stripePayoutId: payout.id },
    data: {
      status,
      paidAt: status === "PAID" ? new Date() : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: `stripe.${event.type}`,
      targetType: "Payout",
      targetId: payout.id,
      metadata: { amount: payout.amount, currency: payout.currency },
    },
  });
}
