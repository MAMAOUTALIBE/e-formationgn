"use server";

// Démarre un paiement CinetPay (Mobile Money + cartes locales).
// Miroir de checkout.ts (Stripe) : la construction de l'Order est déléguée
// au builder partagé `buildCheckoutOrder`, cette action n'orchestre plus que
// l'init transaction côté CinetPay.

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { readAffiliateCode } from "@/lib/affiliate";
import { getCurrentCurrency } from "@/lib/currency";
import {
  CinetPayError,
  initTransaction,
  isCinetPayConfigured,
  type CinetPayCurrency,
} from "@/lib/payments/cinetpay";
import { logError } from "@/lib/logger";
import { isCinetPaySupported } from "@/lib/payments/currency";
import { cinetPayAmountFromMinor } from "@/lib/payments/cinetpay-validation";
import { prisma } from "@/lib/prisma";
import { isTrainingCenterMode } from "@/lib/platform-mode";
import { buildCheckoutOrder } from "@/server/services/checkout-order-builder";

import type { ActionResult } from "./auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Accepte uniquement un UUID v4 — protège du fuzzing.
function sanitizeIdempotencyKey(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)
    ? raw.toLowerCase()
    : null;
}

export async function startCinetPayCheckout(
  formData: FormData,
): Promise<ActionResult> {
  if (isTrainingCenterMode()) {
    return {
      success: false,
      message: "Le paiement est géré en dehors de la plateforme.",
    };
  }
  if (!isCinetPayConfigured()) {
    return {
      success: false,
      message:
        "Le paiement Mobile Money n'est pas encore configuré (CINETPAY_* manquants).",
    };
  }

  const session = await auth();
  if (!session?.user) {
    return {
      success: false,
      message: "Vous devez être connecté pour finaliser votre commande.",
    };
  }
  const userId = session.user.id;
  const currency = await getCurrentCurrency(session.user.preferredCurrency);
  if (!isCinetPaySupported(currency)) {
    return {
      success: false,
      message: `CinetPay ne supporte pas la devise ${currency}.`,
    };
  }

  const affiliateCode = await readAffiliateCode();
  const rawPromoCode = formData.get("promoCode");
  const rawIdempotencyKey = formData.get("idempotencyKey");

  const result = await buildCheckoutOrder({
    userId,
    currency,
    affiliateCode,
    rawPromoCode: typeof rawPromoCode === "string" ? rawPromoCode : null,
    idempotencyKey: sanitizeIdempotencyKey(rawIdempotencyKey),
    // CinetPay : on garde l'historique — pas d'allocation per-line, la
    // commission est calculée sur le total brut de la ligne.
    allocateInstructorDiscount: false,
  });

  if (result.kind === "empty-cart") {
    return { success: false, message: "Votre panier est vide." };
  }
  if (result.kind === "no-eligible-line") {
    return { success: false, message: "Aucun cours disponible dans votre panier." };
  }
  if (result.kind === "promo-error") {
    return { success: false, message: result.message };
  }
  if (result.kind === "free") {
    redirect("/apprentissage");
  }

  // result.kind === "pending"
  const { orderId, totalCents } = result;

  // Récupère infos client (best-effort)
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, lastName: true, name: true },
  });
  const customerName =
    dbUser?.name ||
    [dbUser?.firstName, dbUser?.lastName].filter(Boolean).join(" ") ||
    undefined;

  // Init transaction CinetPay
  try {
    const description = `Gandal — Commande ${orderId.slice(0, 8)}`;
    const initResult = await initTransaction({
      transactionId: orderId,
      // CinetPay attend la valeur en unité entière, dans la devise de l'order.
      // Notre totalCents est déjà en minor units : 1 pour GNF/XOF, 100 pour EUR/USD
      // → on divise donc seulement pour EUR/USD.
      amount: cinetPayAmountFromMinor(totalCents, currency),
      currency: currency as CinetPayCurrency,
      description,
      returnUrl: `${APP_URL}/commande/${orderId}/confirmation`,
      notifyUrl: `${APP_URL}/api/webhooks/cinetpay`,
      customerId: userId,
      customerName,
      customerEmail: dbUser?.email ?? undefined,
      customerCountry: currency === "GNF" ? "GN" : currency === "XOF" ? "CI" : "GN",
    });

    redirect(initResult.paymentUrl);
  } catch (error) {
    // redirect() lève NEXT_REDIRECT — re-throw pour que Next le traite
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    if (error instanceof CinetPayError) {
      logError("cinetpay-checkout", error, { orderId, code: error.code });
      // Marque l'order FAILED pour ne pas laisser un PENDING orphelin
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "FAILED" },
      });
      return {
        success: false,
        message: `Échec de l'initialisation du paiement CinetPay : ${error.message}`,
      };
    }
    logError("cinetpay-checkout", error, { orderId });
    return {
      success: false,
      message: "Erreur inattendue à l'initialisation du paiement.",
    };
  }
}
