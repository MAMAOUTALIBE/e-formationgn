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
    console.warn("[stripe-webhook] signature invalide", error);
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

      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      default:
        // Évènements non gérés : OK 200 pour ne pas faire ré-essayer Stripe.
        break;
    }
  } catch (error) {
    console.error("[stripe-webhook] traitement échoué", error);
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
    console.warn("[stripe-webhook] checkout.session.completed sans orderId");
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
    console.warn("[stripe-webhook] order introuvable", orderId);
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
      console.warn(
        `[stripe-webhook] formateur ${instructorId} sans compte Connect prêt — transfer reporté`,
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
      console.error(
        `[stripe-webhook] transfer échoué pour formateur ${instructorId}`,
        error,
      );
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

  const refundedTotal = (charge.refunds?.data ?? []).reduce(
    (acc, refund) => acc + refund.amount,
    0,
  );

  const status =
    refundedTotal >= order.totalCents ? "REFUNDED" : "PARTIALLY_REFUNDED";

  await prisma.order.update({
    where: { id: order.id },
    data: { status },
  });
}
