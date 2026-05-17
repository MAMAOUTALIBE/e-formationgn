// Cron — retry des webhooks PSP qui ont échoué.
//
// Quand un handler webhook lève (DB indispo, timeout PSP, bug), on marque
// `WebhookEvent.status = FAILED` au lieu de perdre l'événement. Ce cron
// reprend les FAILED jusqu'à 5 tentatives avec backoff (5min, 25min, 2h, …).
//
// Backoff exponentiel : on ne retente un événement que si
//   `attempts * 5min < age`. Au-delà de 5 tentatives, on laisse tomber et
// on garde le payload pour investigation manuelle (les admins peuvent
// requêter en SQL).
//
// On supporte aujourd'hui :
//   - STRIPE (rejoue via `finalizeStripeOrder` pour les checkout.session.completed)
//
// Sécurisé via Bearer ${CRON_SECRET}, planifié dans vercel.json.

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { logError, logInfo } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { finalizeStripeOrder } from "@/server/services/stripe-finalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;
const MAX_PER_RUN = 50;
const BACKOFF_BASE_MS = 5 * 60 * 1000; // 5 min

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

  const now = Date.now();
  const failed = await prisma.webhookEvent.findMany({
    where: {
      status: "FAILED",
      attempts: { lt: MAX_ATTEMPTS },
    },
    take: MAX_PER_RUN,
    orderBy: { receivedAt: "asc" },
  });

  // Filtre backoff : on n'essaie que si suffisamment de temps écoulé depuis
  // receivedAt selon le nombre de tentatives déjà faites.
  const due = failed.filter((event) => {
    const age = now - event.receivedAt.getTime();
    const requiredAge = event.attempts * BACKOFF_BASE_MS;
    return age >= requiredAge;
  });

  let retried = 0;
  let recovered = 0;
  let stillFailing = 0;

  for (const event of due) {
    retried++;
    try {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSING", attempts: { increment: 1 } },
      });

      if (event.source === "STRIPE") {
        await retryStripeEvent(event.payload as unknown as Stripe.Event);
      }
      // CinetPay : pas de retry automatique. Le webhook handler garde l'orderId
      // comme idempotency key, et le cron `reconcile-orders` fait le rattrapage
      // via l'API checkTransaction.

      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: "COMPLETED", processedAt: new Date() },
      });
      recovered++;
      logInfo("process-webhooks", "événement rejoué avec succès", {
        eventId: event.id,
        source: event.source,
        type: event.type,
      });
    } catch (error) {
      stillFailing++;
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: "FAILED",
          lastError: error instanceof Error ? error.message : String(error),
        },
      });
      logError("process-webhooks", error, { eventId: event.id });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: failed.length,
    due: due.length,
    retried,
    recovered,
    stillFailing,
  });
}

async function retryStripeEvent(event: Stripe.Event) {
  if (!isStripeConfigured()) {
    throw new Error("stripe_not_configured");
  }
  const stripe = getStripeClient();

  // Pour l'instant on ne sait re-traiter que les checkout.session.completed.
  // Les autres event types (payment_intent.payment_failed, dispute, etc.) sont
  // moins critiques pour la livraison du cours — on les laisse en FAILED pour
  // investigation manuelle. À étendre au besoin.
  if (event.type !== "checkout.session.completed") {
    throw new Error(`unsupported_retry_type:${event.type}`);
  }
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.orderId;
  if (!orderId) throw new Error("missing_orderId_in_metadata");

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  await finalizeStripeOrder(stripe, orderId, paymentIntentId);
}
