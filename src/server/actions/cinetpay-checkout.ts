"use server";

// Démarre un paiement CinetPay (Mobile Money + cartes locales).
// Miroir de checkout.ts (Stripe) : crée un Order PENDING en DB, puis
// délègue à CinetPay qui renvoie une payment_url. L'utilisateur est
// redirigé vers cette URL ; le webhook /api/webhooks/cinetpay finalise
// l'order quand CinetPay nous renvoie le statut.

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { readAffiliateCode } from "@/lib/affiliate";
import { computeCommission } from "@/lib/commission";
import { getCurrentCurrency } from "@/lib/currency";
import {
  CinetPayError,
  initTransaction,
  isCinetPayConfigured,
  type CinetPayCurrency,
} from "@/lib/payments/cinetpay";
import { logError } from "@/lib/logger";
import { isCinetPaySupported } from "@/lib/payments/currency";
import { prisma } from "@/lib/prisma";
import { promoCodeSchema } from "@/lib/validators/checkout";
import {
  computeCartLines,
  listCartItems,
  tryApplyPromo,
} from "@/server/queries/cart";

import type { ActionResult } from "./auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function startCinetPayCheckout(
  formData: FormData,
): Promise<ActionResult> {
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

  const items = await listCartItems(userId);
  if (items.length === 0) {
    return { success: false, message: "Votre panier est vide." };
  }

  const currency = await getCurrentCurrency(session.user.preferredCurrency);
  if (!isCinetPaySupported(currency)) {
    return {
      success: false,
      message: `CinetPay ne supporte pas la devise ${currency}.`,
    };
  }

  const affiliateCode = await readAffiliateCode();
  const { lines, subtotalCents } = computeCartLines({ items, currency, affiliateCode });
  if (lines.length === 0) {
    return {
      success: false,
      message: "Aucun cours disponible dans votre panier.",
    };
  }

  // Code promo (optionnel) — même logique que checkout Stripe
  const rawCode = formData.get("promoCode");
  let promoApplied: {
    promoCodeId: string;
    code: string;
    discountCents: number;
    instructorId: string | null;
  } | null = null;

  if (typeof rawCode === "string" && rawCode.trim().length > 0) {
    const parsed = promoCodeSchema.safeParse({ code: rawCode.trim() });
    if (parsed.success) {
      const result = await tryApplyPromo({
        code: parsed.data.code,
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

  // Cours gratuits → finalisation immédiate (pas de paiement nécessaire)
  if (totalCents === 0) {
    // On délègue à la logique de checkout.ts (export public d'un finalize
    // gratuit n'existe pas → on duplique la logique courte ici)
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          status: "PAID",
          paidAt: new Date(),
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
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            courseId: line.courseId,
            currency,
            unitPriceCents: line.unitPriceCents,
            discountCents: line.discountCents,
            totalCents: line.totalCents,
            commissionSource: source,
            commissionRateBps: breakdown.rateBps,
            platformFeeCents: breakdown.platformFeeCents,
            instructorPayoutCents: breakdown.instructorPayoutCents,
          },
        });
        await tx.enrollment.upsert({
          where: { userId_courseId: { userId, courseId: line.courseId } },
          update: { orderItemId: undefined, source: "PROMO_FREE" },
          create: { userId, courseId: line.courseId, source: "PROMO_FREE" },
        });
      }
      await tx.cartItem.deleteMany({ where: { userId } });
      if (promoApplied) {
        await tx.promoCode.update({
          where: { id: promoApplied.promoCodeId },
          data: { usedCount: { increment: 1 } },
        });
      }
      return order;
    });
    redirect("/apprentissage");
  }

  // Persiste l'Order PENDING + items
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
      await tx.orderItem.create({
        data: {
          orderId: created.id,
          courseId: line.courseId,
          currency,
          unitPriceCents: line.unitPriceCents,
          discountCents: line.discountCents,
          totalCents: line.totalCents,
          commissionSource: source,
          commissionRateBps: breakdown.rateBps,
          platformFeeCents: breakdown.platformFeeCents,
          instructorPayoutCents: breakdown.instructorPayoutCents,
        },
      });
    }
    return created;
  });

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
    const description = `E-FormationGN — Commande ${order.id.slice(0, 8)}`;
    const result = await initTransaction({
      transactionId: order.id,
      // CinetPay attend la valeur en unité entière, dans la devise de l'order.
      // Notre totalCents est déjà en minor units : 1 pour GNF/XOF, 100 pour EUR/USD
      // → on divise donc seulement pour EUR/USD.
      amount:
        currency === "EUR" || currency === "USD"
          ? Math.round(totalCents / 100)
          : totalCents,
      currency: currency as CinetPayCurrency,
      description,
      returnUrl: `${APP_URL}/commande/${order.id}/confirmation`,
      notifyUrl: `${APP_URL}/api/webhooks/cinetpay`,
      customerId: userId,
      customerName,
      customerEmail: dbUser?.email ?? undefined,
      customerCountry: currency === "GNF" ? "GN" : currency === "XOF" ? "CI" : "GN",
    });

    redirect(result.paymentUrl);
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
      logError("cinetpay-checkout", error, { orderId: order.id, code: error.code });
      // Marque l'order FAILED pour ne pas laisser un PENDING orphelin
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "FAILED" },
      });
      return {
        success: false,
        message: `Échec de l'initialisation du paiement CinetPay : ${error.message}`,
      };
    }
    logError("cinetpay-checkout", error, { orderId: order.id });
    return {
      success: false,
      message: "Erreur inattendue à l'initialisation du paiement.",
    };
  }
}
