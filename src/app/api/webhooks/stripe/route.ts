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
// Sécurité :
//   - Signature vérifiée avec STRIPE_WEBHOOK_SECRET.
//   - Chaque eventId est persisté dans WebhookEvent (PK = eventId). Si Stripe
//     rejoue un événement déjà COMPLETED, on retourne 200 immédiatement sans
//     ré-exécuter le handler (protection contre les replays + audit trail).
//   - Le handler de checkout est extrait dans `finalizeStripeOrder` pour être
//     partagé avec le cron de réconciliation.

import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { logError, logWarning } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  getStripeClient,
  STRIPE_WEBHOOK_SECRET,
  isStripeConfigured,
} from "@/lib/stripe";
import { createAuditLog } from "@/server/services/audit-log";
import { finalizeStripeOrder } from "@/server/services/stripe-finalize";

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

  // Idempotency layer : on persiste l'eventId. Si déjà traité (COMPLETED),
  // on ACK 200 sans rejouer le handler — protège des replays Stripe.
  const existing = await prisma.webhookEvent.findUnique({
    where: { id: event.id },
    select: { status: true },
  });
  if (existing && existing.status === "COMPLETED") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (!existing) {
    try {
      await prisma.webhookEvent.create({
        data: {
          id: event.id,
          source: "STRIPE",
          type: event.type,
          payload: event as unknown as object,
          status: "PROCESSING",
          attempts: 1,
        },
      });
    } catch {
      // Race : un autre worker a déjà inséré le même eventId. ACK 200, l'autre
      // worker le traite ou l'a déjà traité.
      return NextResponse.json({ received: true, race: true });
    }
  } else {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
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
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: "FAILED",
        lastError: error instanceof Error ? error.message : String(error),
      },
    });
    // 500 → Stripe re-tentera ; le cron `/api/cron/process-webhooks` peut
    // aussi le reprendre depuis le payload persisté.
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  await prisma.webhookEvent.update({
    where: { id: event.id },
    data: { status: "COMPLETED", processedAt: new Date() },
  });

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// checkout.session.completed — délégué au service partagé (utilisé aussi par
// le cron `/api/cron/reconcile-orders` pour rattraper les webhooks manqués).
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    logWarning("stripe-webhook", "checkout.session.completed sans orderId", {
      sessionId: session.id,
    });
    return;
  }
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  await finalizeStripeOrder(stripe, orderId, paymentIntentId);
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
  await createAuditLog({
    action: `stripe.dispute.${event.type.split(".").pop()}`,
    targetType: "Dispute",
    targetId: dispute.id,
    metadata: { orderId: order.id, amount: dispute.amount, reason: dispute.reason },
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

  await createAuditLog({
    action: `stripe.${event.type}`,
    targetType: "Payout",
    targetId: payout.id,
    metadata: { amount: payout.amount, currency: payout.currency },
  });
}
