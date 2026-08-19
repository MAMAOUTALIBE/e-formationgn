// Webhook (IPN) CinetPay — finalise les commandes après paiement Mobile
// Money / carte locale.
//
// Flux :
//   1. CinetPay POST ce endpoint avec le body de la transaction + en-tête
//      `x-token` (HMAC-SHA256 du body avec notre secret).
//   2. On vérifie la signature.
//   3. On RE-VÉRIFIE côté serveur via /payment/check (CinetPay le recommande
//      explicitement : ne jamais faire confiance au seul payload IPN qui peut
//      être falsifié si l'attaquant connaît le format).
//   4. Si ACCEPTED → marque l'Order PAID, crée Enrollments, vide panier.
//      (Logique miroir de stripe/route.ts handleCheckoutCompleted.)

import { NextResponse } from "next/server";

import {
  checkTransaction,
  isCinetPayConfigured,
  verifyIpnSignature,
} from "@/lib/payments/cinetpay";
import { sendTransactionalEmail } from "@/lib/email/client";
import { renderBrandedEmail } from "@/lib/email/templates";
import { logError, logWarning } from "@/lib/logger";
import { formatMinor } from "@/lib/payments/currency";
import { validateCinetPayAcceptedPayment } from "@/lib/payments/cinetpay-validation";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit-log";

const PRIVATE_NO_STORE = "private, no-store, max-age=0";

export async function POST(request: Request) {
  if (!isCinetPayConfigured()) {
    return NextResponse.json(
      { error: "cinetpay_not_configured" },
      { status: 503, headers: { "Cache-Control": PRIVATE_NO_STORE } },
    );
  }

  const rawBody = await request.text();
  const token = request.headers.get("x-token");

  if (!verifyIpnSignature(rawBody, token)) {
    logWarning("cinetpay-webhook", "Signature x-token invalide");
    return NextResponse.json(
      { error: "invalid_signature" },
      { status: 400, headers: { "Cache-Control": PRIVATE_NO_STORE } },
    );
  }

  // CinetPay envoie soit form-urlencoded, soit JSON selon la config compte.
  // On parse les deux.
  let payload: Record<string, unknown> = {};
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = {};
    }
  } else {
    const params = new URLSearchParams(rawBody);
    for (const [k, v] of params.entries()) payload[k] = v;
  }

  const transactionId =
    typeof payload.cpm_trans_id === "string"
      ? payload.cpm_trans_id
      : typeof payload.transaction_id === "string"
        ? payload.transaction_id
        : null;

  if (!transactionId) {
    logWarning("cinetpay-webhook", "Pas de transaction_id dans le payload", { payload });
    return NextResponse.json(
      { error: "missing_transaction_id" },
      { status: 400, headers: { "Cache-Control": PRIVATE_NO_STORE } },
    );
  }

  // Idempotency layer — la PK = transactionId (= orderId). Si CinetPay rejoue
  // après un ACK manqué, on no-op au 2e hit.
  const eventId = `cinetpay_${transactionId}`;
  const existing = await prisma.webhookEvent.findUnique({
    where: { id: eventId },
    select: { status: true },
  });
  if (existing && existing.status === "COMPLETED") {
    return NextResponse.json(
      { received: true, duplicate: true },
      { headers: { "Cache-Control": PRIVATE_NO_STORE } },
    );
  }
  if (!existing) {
    try {
      await prisma.webhookEvent.create({
        data: {
          id: eventId,
          source: "CINETPAY",
          type: "payment.ipn",
          payload: payload as unknown as object,
          status: "PROCESSING",
          attempts: 1,
        },
      });
    } catch {
      return NextResponse.json(
        { received: true, race: true },
        { headers: { "Cache-Control": PRIVATE_NO_STORE } },
      );
    }
  } else {
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
  }

  try {
    // Re-vérification côté serveur — recommandé par CinetPay
    const verdict = await checkTransaction(transactionId);

    if (verdict.status !== "ACCEPTED") {
      // Refusé / annulé / pending — on met à jour l'Order si pertinent,
      // mais on n'enrolle pas l'élève.
      if (verdict.status === "REFUSED") {
        await prisma.order.updateMany({
          where: { id: transactionId, status: "PENDING" },
          data: { status: "FAILED" },
        });
      }
      await prisma.webhookEvent.update({
        where: { id: eventId },
        data: { status: "COMPLETED", processedAt: new Date() },
      });
      return NextResponse.json(
        { received: true, status: verdict.status },
        { headers: { "Cache-Control": PRIVATE_NO_STORE } },
      );
    }

    const orderExpectation = await prisma.order.findUnique({
      where: { id: transactionId },
      select: { id: true, totalCents: true, currency: true },
    });
    const validation = orderExpectation
      ? validateCinetPayAcceptedPayment(verdict, {
          ...orderExpectation,
          siteId: process.env.CINETPAY_SITE_ID,
        })
      : { ok: false as const, reason: "transaction_id" as const };
    if (!validation.ok) {
      await prisma.$transaction([
        prisma.order.updateMany({
          where: { id: transactionId, status: "PENDING" },
          data: { status: "PROCESSING" },
        }),
        prisma.webhookEvent.update({
          where: { id: eventId },
          data: {
            status: "FAILED",
            processedAt: new Date(),
            lastError: `PAYMENT_VERIFICATION_MISMATCH:${validation.reason}`,
          },
        }),
      ]);
      logWarning("cinetpay-webhook", "Paiement accepté non conforme", {
        orderId: transactionId,
        reason: validation.reason,
      });
      await createAuditLog({
        action: "cinetpay.payment_verification_mismatch",
        targetType: "Order",
        targetId: orderExpectation?.id ?? null,
        metadata: { reason: validation.reason, eventId },
      });
      return NextResponse.json(
        { received: true, status: "REVIEW_REQUIRED" },
        { headers: { "Cache-Control": PRIVATE_NO_STORE } },
      );
    }

    // ACCEPTED : on traite comme un checkout completed Stripe.
    await handleAccepted(transactionId);

    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: "COMPLETED", processedAt: new Date() },
    });
    return NextResponse.json(
      { received: true, status: "ACCEPTED" },
      { headers: { "Cache-Control": PRIVATE_NO_STORE } },
    );
  } catch (error) {
    logError("cinetpay-webhook", error, { transactionId });
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: "FAILED",
        lastError: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json(
      { error: "handler_error" },
      { status: 500, headers: { "Cache-Control": PRIVATE_NO_STORE } },
    );
  }
}

// ---------------------------------------------------------------------------
// Idempotent : si l'Order est déjà PAID on no-op.
// ---------------------------------------------------------------------------
async function handleAccepted(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          course: { select: { id: true, title: true, instructorId: true } },
        },
      },
      user: { select: { id: true, email: true, firstName: true } },
    },
  });

  if (!order) {
    logWarning("cinetpay-webhook", "Order introuvable", { orderId });
    return;
  }
  if (order.status === "PAID") return; // idempotence

  const finalized = await prisma.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({
      where: { id: order.id, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "PAID", paidAt: new Date() },
    });
    if (claim.count !== 1) return false;

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
    return true;
  });
  if (!finalized) return;

  // Email confirmation — best-effort, n'échoue pas le webhook si l'envoi rate.
  if (order.user.email) {
    try {
      const itemsList = order.items.map((i) => `• ${i.course.title}`).join("<br />");
      const { html, text } = renderBrandedEmail({
        preview: "Confirmation de votre paiement Gandal",
        heading: "Merci pour votre paiement",
        body: `<p style="margin:0 0 12px 0;">Bonjour ${order.user.firstName ?? ""},</p>
               <p style="margin:0 0 12px 0;">Votre paiement de <strong>${formatMinor(order.totalCents, order.currency)}</strong> via Mobile Money / carte locale a bien été enregistré.</p>
               <p style="margin:0 0 12px 0;">Formations auxquelles vous êtes désormais inscrit·e :</p>
               <p style="margin:0 0 12px 0;">${itemsList}</p>`,
        ctaLabel: "Accéder à mes formations",
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/apprentissage`,
      });
      await sendTransactionalEmail({
        to: order.user.email,
        subject: "Confirmation de paiement — Gandal",
        html,
        text,
      });
    } catch (err) {
      logError("cinetpay-webhook", err, {
        operation: "confirmation-email",
        orderId: order.id,
      });
    }
  }

  await createAuditLog({
    action: "cinetpay.payment_accepted",
    targetType: "Order",
    targetId: order.id,
    metadata: { totalCents: order.totalCents, currency: order.currency },
  });
}
