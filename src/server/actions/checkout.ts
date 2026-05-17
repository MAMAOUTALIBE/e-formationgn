"use server";

// Démarre une session Stripe Checkout pour le panier de l'utilisateur.
//
// La construction de l'Order (lignes, commissions, allocation remise formateur,
// finalisation gratuit) est déléguée à `buildCheckoutOrder` — partagé avec
// CinetPay. Cette action n'orchestre plus que l'ouverture de la Stripe
// Checkout Session.
//
// L'inscription (Enrollment) et le Stripe Transfer ne sont créés qu'au
// passage du webhook `checkout.session.completed` — c'est la seule façon
// de garantir que le paiement a bien eu lieu.

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { readAffiliateCode } from "@/lib/affiliate";
import { getCurrentCurrency } from "@/lib/currency";
import { centsToAmount } from "@/lib/money";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { computeCartLines, listCartItems } from "@/server/queries/cart";
import { buildCheckoutOrder } from "@/server/services/checkout-order-builder";

import type { ActionResult } from "./auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function startCheckout(formData: FormData): Promise<ActionResult> {
  if (!isStripeConfigured()) {
    return {
      success: false,
      message:
        "Le paiement n'est pas encore configuré sur la plateforme. Renseignez STRIPE_SECRET_KEY dans .env.",
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
  const affiliateCode = await readAffiliateCode();

  const rawPromoCode = formData.get("promoCode");

  const result = await buildCheckoutOrder({
    userId,
    currency,
    affiliateCode,
    rawPromoCode: typeof rawPromoCode === "string" ? rawPromoCode : null,
    // Stripe : on alloue la remise du code formateur par ligne pour que
    // le transfer suivant prenne la bonne part (commission plateforme préservée).
    allocateInstructorDiscount: true,
  });

  if (result.kind === "empty-cart") {
    return { success: false, message: "Votre panier est vide." };
  }
  if (result.kind === "no-eligible-line") {
    return {
      success: false,
      message: "Aucun cours disponible dans votre panier (peut-être retirés du catalogue).",
    };
  }
  if (result.kind === "promo-error") {
    return { success: false, message: result.message };
  }
  if (result.kind === "free") {
    redirect(`/commande/${result.orderId}/confirmation`);
  }

  // result.kind === "pending"
  const { orderId, totalCents, lines, items, promo } = result;

  // Customer Stripe
  const stripe = getStripeClient();
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, email: true, name: true },
  });
  let customerId = dbUser?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: dbUser?.email ?? undefined,
      name: dbUser?.name ?? undefined,
      metadata: { userId },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    });
  }

  // Line items Stripe : un par OrderItem
  const lineItems = lines.map((line) => {
    const item = items.find((c) => c.course.id === line.courseId)!;
    return {
      price_data: {
        currency: currency.toLowerCase(),
        product_data: {
          name: item.course.title,
          images: item.course.thumbnailUrl ? [item.course.thumbnailUrl] : undefined,
          metadata: { courseId: item.course.id },
        },
        unit_amount: line.totalCents,
      },
      quantity: 1,
    };
  });

  // Discount Stripe (en cents) — on utilise un coupon ad-hoc si promo
  const stripeSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    payment_intent_data: {
      metadata: { orderId, userId },
    },
    line_items: lineItems,
    discounts: promo
      ? [
          {
            coupon: (
              await stripe.coupons.create({
                amount_off: promo.discountCents,
                currency: currency.toLowerCase(),
                duration: "once",
                name: `Code ${promo.code}`,
                metadata: { promoCodeId: promo.promoCodeId },
              })
            ).id,
          },
        ]
      : undefined,
    metadata: { orderId, userId },
    success_url: `${APP_URL}/commande/${orderId}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/panier?canceled=1`,
    allow_promotion_codes: false,
    locale: "fr",
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { stripeCheckoutSessionId: stripeSession.id },
  });

  if (!stripeSession.url) {
    // Garde-fou — totalCents > 0 garanti par le builder.
    void totalCents;
    return {
      success: false,
      message: "Stripe n'a pas renvoyé d'URL de paiement.",
    };
  }
  redirect(stripeSession.url);
}

// Helper purement client : montrer le total dans la sidebar du panier.
export async function previewCartTotal(): Promise<{
  subtotalCents: number;
  totalCents: number;
  currency: "EUR" | "USD" | "GNF" | "XOF";
} | null> {
  const session = await auth();
  if (!session?.user) return null;
  const items = await listCartItems(session.user.id);
  const currency = await getCurrentCurrency(session.user.preferredCurrency);
  const affiliateCode = await readAffiliateCode();
  const { subtotalCents } = computeCartLines({ items, currency, affiliateCode });
  return { subtotalCents, totalCents: subtotalCents, currency };
}

// ré-export pour l'UI (formatage pretty)
export { centsToAmount };
