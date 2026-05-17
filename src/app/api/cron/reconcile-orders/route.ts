// Cron horaire — réconciliation des Orders restés PENDING > 30 min.
//
// Pourquoi ce job existe : un webhook PSP peut être perdu (panne réseau côté
// Stripe, déploiement pendant le hit, erreur 500 transitoire). Sans cron de
// rattrapage, l'élève a payé et son Order reste PENDING à vie → il n'a pas
// son cours. Inacceptable.
//
// Algo :
//   1. Liste les Order PENDING avec createdAt < NOW - 30min
//   2. Pour chaque, interroge le PSP (Stripe ou CinetPay) selon les IDs
//      stockés en base
//   3. Si le PSP dit "payé" → on appelle le service `finalizeStripeOrder`
//      (mêmes effets que le webhook : Enrollment + Transfer + email)
//   4. Si le PSP dit "expiré/annulé" → marque l'Order CANCELLED
//   5. Sinon → laisse en PENDING, le prochain run retentera
//
// Sécurisé via Bearer ${CRON_SECRET}, planifié dans vercel.json.

import { NextRequest, NextResponse } from "next/server";

import { logError, logInfo, logWarning } from "@/lib/logger";
import { checkTransaction, isCinetPayConfigured } from "@/lib/payments/cinetpay";
import { prisma } from "@/lib/prisma";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { finalizeStripeOrder } from "@/server/services/stripe-finalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECONCILE_AFTER_MS = 30 * 60 * 1000; // 30 min
const MAX_PER_RUN = 100; // garde-fou pour éviter de tout traiter d'un coup

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RECONCILE_AFTER_MS);
  const candidates = await prisma.order.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      stripeCheckoutSessionId: true,
      stripePaymentIntentId: true,
      // Note : CinetPay utilise l'id de l'Order comme transactionId.
    },
    take: MAX_PER_RUN,
    orderBy: { createdAt: "asc" },
  });

  let finalized = 0;
  let cancelled = 0;
  let unchanged = 0;
  let errors = 0;

  for (const order of candidates) {
    try {
      // Stripe path : si on a un sessionId, on demande à Stripe ce qu'il en est.
      if (order.stripeCheckoutSessionId && isStripeConfigured()) {
        const stripe = getStripeClient();
        const session = await stripe.checkout.sessions.retrieve(
          order.stripeCheckoutSessionId,
        );
        const paid =
          session.payment_status === "paid" ||
          session.status === "complete";
        if (paid) {
          const pi =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? order.stripePaymentIntentId ?? null);
          const result = await finalizeStripeOrder(stripe, order.id, pi);
          if (result.ok) {
            finalized++;
            logInfo("reconcile-orders", "order finalisé via cron", {
              orderId: order.id,
              reason: result.reason,
            });
          }
        } else if (session.status === "expired") {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: "CANCELLED" },
          });
          cancelled++;
        } else {
          unchanged++;
        }
        continue;
      }

      // CinetPay path : pas de sessionId Stripe → on tente CinetPay
      // (orderId = transactionId par convention dans `cinetpay-checkout.ts`).
      if (isCinetPayConfigured()) {
        const verdict = await checkTransaction(order.id);
        if (verdict.status === "ACCEPTED") {
          // On marque l'Order PAID — le finalize complet (Enrollment etc.) est
          // dans le webhook handler CinetPay, qui sera ré-essayé via
          // `/api/cron/process-webhooks` ou re-déclenché si CinetPay rejoue.
          // Ici on se contente de la transition d'état pour ne pas dupliquer
          // la logique métier dans deux endroits.
          await prisma.order.updateMany({
            where: { id: order.id, status: "PENDING" },
            data: { status: "PROCESSING" }, // signal pour investigation manuelle
          });
          finalized++;
          logWarning("reconcile-orders", "CinetPay payé mais pas finalisé", {
            orderId: order.id,
            hint: "vérifier webhook CinetPay manqué",
          });
        } else if (verdict.status === "REFUSED") {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: "FAILED" },
          });
          cancelled++;
        } else {
          unchanged++;
        }
        continue;
      }

      unchanged++;
    } catch (error) {
      errors++;
      logError("reconcile-orders", error, { orderId: order.id });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    finalized,
    cancelled,
    unchanged,
    errors,
  });
}
