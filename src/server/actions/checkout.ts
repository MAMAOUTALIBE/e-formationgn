"use server";

// Démarre une session Stripe Checkout pour le panier de l'utilisateur.
//
// Étapes :
//   1. Récupère panier + devise + code d'affiliation + code promo éventuel
//   2. Pour chaque cours : calcule unitaire, remise, total, et la
//      commissionSource (15 % si affilié, 30 % sinon)
//   3. Persiste un Order PENDING + ses OrderItems (snapshot)
//   4. Crée la Stripe Checkout Session vers la plateforme
//   5. Retourne l'URL de redirection
//
// L'inscription (Enrollment) et le Stripe Transfer ne sont créés qu'au
// passage du webhook `checkout.session.completed` — c'est la seule façon
// de garantir que le paiement a bien eu lieu.

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { readAffiliateCode } from "@/lib/affiliate";
import { computeCommission, DEFAULT_COMMISSION_RATES } from "@/lib/commission";
import { getCurrentCurrency } from "@/lib/currency";
import { centsToAmount } from "@/lib/money";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { promoCodeSchema } from "@/lib/validators/checkout";
import {
  computeCartLines,
  listCartItems,
  tryApplyPromo,
} from "@/server/queries/cart";

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

  const items = await listCartItems(userId);
  if (items.length === 0) {
    return { success: false, message: "Votre panier est vide." };
  }

  const currency = await getCurrentCurrency(session.user.preferredCurrency);
  const affiliateCode = await readAffiliateCode();

  const { lines, subtotalCents } = computeCartLines({ items, currency, affiliateCode });
  if (lines.length === 0) {
    return {
      success: false,
      message: "Aucun cours disponible dans votre panier (peut-être retirés du catalogue).",
    };
  }

  // Code promo (optionnel)
  const rawCode = formData.get("promoCode");
  let promoApplied: {
    promoCodeId: string;
    code: string;
    discountCents: number;
    instructorId: string | null;
  } | null = null;

  if (typeof rawCode === "string" && rawCode.trim().length > 0) {
    const parsedCode = promoCodeSchema.safeParse({ code: rawCode.trim() });
    if (parsedCode.success) {
      const result = await tryApplyPromo({
        code: parsedCode.data.code,
        currency,
        subtotalCents,
        cart: lines.map((l) => ({ courseId: l.courseId, instructorId: l.instructorId })),
      });
      if (result.ok) {
        promoApplied = {
          promoCodeId: result.promo.promoCodeId,
          code: result.promo.code,
          discountCents: result.promo.discountCents,
          instructorId: result.promo.instructorId,
        };
      } else {
        return { success: false, message: result.message };
      }
    } else {
      return { success: false, message: "Code promo invalide." };
    }
  }

  const totalCents = Math.max(0, subtotalCents - (promoApplied?.discountCents ?? 0));

  // Cours à 0 € (gratuit ou totalement réduit) : on les inscrit directement
  // sans passer par Stripe. Ce serait étrange d'envoyer un montant nul.
  if (totalCents === 0) {
    return finalizeFreeCheckout({
      userId,
      lines,
      currency,
      affiliateCode,
      promoApplied,
      subtotalCents,
    });
  }

  // Allocation per-line de la remise pour les codes formateur :
  // la remise sort entièrement de la part du formateur, pas de la commission
  // plateforme. Pour les codes plateforme (sans instructorId), on garde le
  // comportement historique : la remise est absorbée au niveau de l'order
  // (la commission par ligne reste calculée sur le prix pré-promo).
  const instructorDiscountByLine = allocateInstructorDiscount(lines, promoApplied);

  // Création de l'Order PENDING + items
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId,
        status: "PENDING",
        currency,
        subtotalCents,
        discountCents: promoApplied?.discountCents ?? 0,
        totalCents,
        promoCodeId: promoApplied?.promoCodeId ?? null,
        affiliateCode: affiliateCode ?? null,
      },
    });

    for (const line of lines) {
      const source = line.isInstructorDriven ? "INSTRUCTOR_DRIVEN" : "PLATFORM_DRIVEN";
      const breakdown = computeCommission(line.totalCents, source);
      const lineInstructorDiscount = instructorDiscountByLine.get(line.courseId) ?? 0;
      await tx.orderItem.create({
        data: {
          orderId: created.id,
          courseId: line.courseId,
          currency,
          unitPriceCents: line.unitPriceCents,
          discountCents: line.discountCents + lineInstructorDiscount,
          totalCents: line.totalCents - lineInstructorDiscount,
          commissionSource: source,
          commissionRateBps: breakdown.rateBps,
          platformFeeCents: breakdown.platformFeeCents,
          instructorPayoutCents: breakdown.instructorPayoutCents - lineInstructorDiscount,
        },
      });
    }
    return created;
  });

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
      metadata: { orderId: order.id, userId },
    },
    line_items: lineItems,
    discounts: promoApplied
      ? [
          {
            coupon: (
              await stripe.coupons.create({
                amount_off: promoApplied.discountCents,
                currency: currency.toLowerCase(),
                duration: "once",
                name: `Code ${promoApplied.code}`,
                metadata: { promoCodeId: promoApplied.promoCodeId },
              })
            ).id,
          },
        ]
      : undefined,
    metadata: { orderId: order.id, userId },
    success_url: `${APP_URL}/commande/${order.id}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/panier?canceled=1`,
    allow_promotion_codes: false,
    locale: "fr",
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { stripeCheckoutSessionId: stripeSession.id },
  });

  if (!stripeSession.url) {
    return {
      success: false,
      message: "Stripe n'a pas renvoyé d'URL de paiement.",
    };
  }
  redirect(stripeSession.url);
}

// ---------------------------------------------------------------------------
// Cas particulier : panier à 0 € → on saute Stripe et on inscrit directement.
// ---------------------------------------------------------------------------

async function finalizeFreeCheckout({
  userId,
  lines,
  currency,
  affiliateCode,
  promoApplied,
  subtotalCents,
}: {
  userId: string;
  lines: ReturnType<typeof computeCartLines>["lines"];
  currency: "EUR" | "USD" | "GNF" | "XOF";
  affiliateCode: string | null;
  promoApplied: {
    promoCodeId: string;
    code: string;
    discountCents: number;
    instructorId: string | null;
  } | null;
  subtotalCents: number;
}): Promise<ActionResult> {
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId,
        status: "PAID",
        currency,
        subtotalCents,
        discountCents: promoApplied?.discountCents ?? subtotalCents,
        totalCents: 0,
        paidAt: new Date(),
        promoCodeId: promoApplied?.promoCodeId ?? null,
        affiliateCode: affiliateCode ?? null,
      },
    });

    for (const line of lines) {
      const source = line.isInstructorDriven ? "INSTRUCTOR_DRIVEN" : "PLATFORM_DRIVEN";
      const item = await tx.orderItem.create({
        data: {
          orderId: created.id,
          courseId: line.courseId,
          currency,
          unitPriceCents: line.unitPriceCents,
          discountCents: line.discountCents,
          totalCents: 0,
          commissionSource: source,
          commissionRateBps: DEFAULT_COMMISSION_RATES[source],
          platformFeeCents: 0,
          instructorPayoutCents: 0,
        },
      });

      await tx.enrollment.upsert({
        where: { userId_courseId: { userId, courseId: line.courseId } },
        update: {
          orderItemId: item.id,
          source: promoApplied ? "PROMO_FREE" : "PURCHASE",
        },
        create: {
          userId,
          courseId: line.courseId,
          orderItemId: item.id,
          source: promoApplied ? "PROMO_FREE" : "PURCHASE",
        },
      });

      await tx.course.update({
        where: { id: line.courseId },
        data: { totalEnrollments: { increment: 1 } },
      });
    }

    await tx.cartItem.deleteMany({ where: { userId } });
    return created;
  });

  if (promoApplied) {
    await prisma.promoCode.update({
      where: { id: promoApplied.promoCodeId },
      data: { usedCount: { increment: 1 } },
    });
  }

  redirect(`/commande/${order.id}/confirmation`);
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

// ---------------------------------------------------------------------------
// Allocation per-line de la remise issue d'un code promo formateur.
// La remise est répartie au prorata des montants des lignes (toutes
// appartenant au même formateur, garanti par tryApplyPromo). Le reliquat
// d'arrondi est ajouté à la dernière ligne pour conserver l'invariant
// `sum(lineDiscount) === totalDiscount`.
// ---------------------------------------------------------------------------

function allocateInstructorDiscount(
  lines: ReturnType<typeof computeCartLines>["lines"],
  promoApplied: {
    discountCents: number;
    instructorId: string | null;
  } | null,
): Map<string, number> {
  const allocation = new Map<string, number>();
  if (!promoApplied || !promoApplied.instructorId) return allocation;

  const eligibleLines = lines.filter(
    (l) => l.instructorId === promoApplied.instructorId,
  );
  if (eligibleLines.length === 0) return allocation;

  const eligibleTotal = eligibleLines.reduce((sum, l) => sum + l.totalCents, 0);
  if (eligibleTotal <= 0) return allocation;

  const totalDiscount = Math.min(promoApplied.discountCents, eligibleTotal);
  let remaining = totalDiscount;
  for (let i = 0; i < eligibleLines.length; i++) {
    const line = eligibleLines[i];
    const isLast = i === eligibleLines.length - 1;
    const share = isLast
      ? remaining
      : Math.floor((totalDiscount * line.totalCents) / eligibleTotal);
    allocation.set(line.courseId, share);
    remaining -= share;
  }
  return allocation;
}
