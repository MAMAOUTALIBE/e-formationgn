import "server-only";

// Builder partagé Stripe ↔ CinetPay :
// rassemble la logique de checkout commune (charger panier, appliquer promo,
// allouer la remise formateur, créer Order + OrderItems, finaliser si gratuit)
// pour qu'un seul endroit décide du contenu et des montants d'une commande.
//
// Les actions Stripe/CinetPay n'ont plus qu'à gérer la partie « initialisation
// du provider » (Checkout Session / payment_url) après le résultat de ce builder.

import type { Currency } from "@/generated/prisma/enums";
import { computeCommission, DEFAULT_COMMISSION_RATES } from "@/lib/commission";
import { prisma } from "@/lib/prisma";
import { promoCodeSchema } from "@/lib/validators/checkout";
import {
  computeCartLines,
  listCartItems,
  tryApplyPromo,
  type CartItemRow,
  type CartLineComputation,
} from "@/server/queries/cart";
import { guardAffiliateCode } from "./affiliate-fraud";

export interface AppliedPromoSnapshot {
  promoCodeId: string;
  code: string;
  discountCents: number;
  instructorId: string | null;
}

export type BuildOrderResult =
  | { kind: "empty-cart" }
  | { kind: "no-eligible-line" }
  | { kind: "promo-error"; message: string }
  | {
      // Total = 0 : la commande est immédiatement marquée PAID, les
      // enrollments sont créés, et le panier vidé. Le caller n'a plus qu'à
      // rediriger vers /apprentissage (ou /commande/[id]/confirmation).
      kind: "free";
      orderId: string;
    }
  | {
      // Total > 0 : commande PENDING, le caller doit ouvrir une session
      // de paiement chez le provider et stocker son ID.
      kind: "pending";
      orderId: string;
      currency: Currency;
      subtotalCents: number;
      totalCents: number;
      lines: CartLineComputation[];
      items: CartItemRow[];
      promo: AppliedPromoSnapshot | null;
    };

export interface BuildOrderInput {
  userId: string;
  currency: Currency;
  affiliateCode: string | null;
  // Texte brut du champ formData "promoCode" (peut être null/empty).
  rawPromoCode: string | null;
  // Si true, alloue la remise du code formateur par ligne (mode Stripe :
  // on diminue `instructorPayoutCents` ligne par ligne). Si false, on conserve
  // la remise au niveau de l'order et la commission est calculée sur le
  // total brut (mode CinetPay actuel).
  allocateInstructorDiscount?: boolean;
  // UUID v4 généré côté client à chaque submit du panier. Si fourni et qu'un
  // Order PENDING avec cette même clé existe pour ce user, on le retourne
  // au lieu d'en créer un nouveau (protection anti double-clic).
  idempotencyKey?: string | null;
}

export async function buildCheckoutOrder(
  input: BuildOrderInput,
): Promise<BuildOrderResult> {
  const { userId, currency, idempotencyKey } = input;

  // Idempotency client : si on a déjà un Order PENDING avec cette clé pour
  // ce user, on le retourne tel quel. Le user va être renvoyé vers la même
  // session Stripe/CinetPay (déjà persistée en DB). Protège des double-clics
  // et des retries du formulaire après une erreur réseau côté browser.
  if (idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: { items: { include: { course: true } } },
    });
    if (existing && existing.status === "PENDING") {
      // Reconstruit un résultat "pending" minimal — le caller utilisera juste
      // orderId pour relancer la session PSP (qui retournera elle-même
      // l'URL existante grâce à son propre idempotencyKey serveur).
      return {
        kind: "pending",
        orderId: existing.id,
        currency: existing.currency,
        subtotalCents: existing.subtotalCents,
        totalCents: existing.totalCents,
        lines: existing.items.map((i) => ({
          courseId: i.courseId,
          instructorId: i.course.instructorId,
          unitPriceCents: i.unitPriceCents,
          discountCents: i.discountCents,
          totalCents: i.totalCents,
          isInstructorDriven: i.commissionSource === "INSTRUCTOR_DRIVEN",
        })),
        items: [],
        promo: null,
      };
    }
  }

  // Garde anti-fraude affiliation : si le code est suspect (self-referral,
  // velocity cap, IP collision), on neutralise l'affiliation. La commande
  // continue mais avec la commission standard (PLATFORM_DRIVEN). Logged
  // dans AuditLog côté guardAffiliateCode pour investigation manuelle.
  let affiliateCode = input.affiliateCode;
  if (affiliateCode) {
    const guard = await guardAffiliateCode({ affiliateCode, buyerId: userId });
    if (!guard.honored) {
      affiliateCode = null;
    }
  }

  const items = await listCartItems(userId);
  if (items.length === 0) return { kind: "empty-cart" };

  const { lines, subtotalCents } = computeCartLines({
    items,
    currency,
    affiliateCode,
  });
  if (lines.length === 0) return { kind: "no-eligible-line" };

  // Promo code (optionnel)
  let promo: AppliedPromoSnapshot | null = null;
  if (input.rawPromoCode && input.rawPromoCode.trim().length > 0) {
    const parsed = promoCodeSchema.safeParse({ code: input.rawPromoCode.trim() });
    if (!parsed.success) {
      return { kind: "promo-error", message: "Code promo invalide." };
    }
    const result = await tryApplyPromo({
      code: parsed.data.code,
      currency,
      subtotalCents,
      cart: lines.map((l) => ({ courseId: l.courseId, instructorId: l.instructorId })),
    });
    if (!result.ok) return { kind: "promo-error", message: result.message };
    promo = {
      promoCodeId: result.promo.promoCodeId,
      code: result.promo.code,
      discountCents: result.promo.discountCents,
      instructorId: result.promo.instructorId,
    };
  }

  const totalCents = Math.max(0, subtotalCents - (promo?.discountCents ?? 0));

  if (totalCents === 0) {
    const order = await finalizeFreeOrder({
      userId,
      currency,
      subtotalCents,
      lines,
      promo,
      affiliateCode,
      idempotencyKey: idempotencyKey ?? null,
    });
    return { kind: "free", orderId: order.id };
  }

  const allocate = input.allocateInstructorDiscount ?? false;
  const instructorDiscountByLine = allocate
    ? allocateInstructorDiscount(lines, promo)
    : new Map<string, number>();

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId,
        status: "PENDING",
        currency,
        subtotalCents,
        discountCents: promo?.discountCents ?? 0,
        totalCents,
        promoCodeId: promo?.promoCodeId ?? null,
        affiliateCode: affiliateCode ?? null,
        idempotencyKey: idempotencyKey ?? null,
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
          instructorPayoutCents:
            breakdown.instructorPayoutCents - lineInstructorDiscount,
        },
      });
    }
    return created;
  });

  return {
    kind: "pending",
    orderId: order.id,
    currency,
    subtotalCents,
    totalCents,
    lines,
    items,
    promo,
  };
}

// Allocation per-line de la remise issue d'un code promo formateur.
// La remise est répartie au prorata des montants des lignes (toutes
// appartenant au même formateur, garanti par tryApplyPromo). Le reliquat
// d'arrondi est ajouté à la dernière ligne pour conserver l'invariant
// `sum(lineDiscount) === totalDiscount`.
function allocateInstructorDiscount(
  lines: CartLineComputation[],
  promo: AppliedPromoSnapshot | null,
): Map<string, number> {
  const allocation = new Map<string, number>();
  if (!promo || !promo.instructorId) return allocation;

  const eligible = lines.filter((l) => l.instructorId === promo.instructorId);
  if (eligible.length === 0) return allocation;

  const eligibleTotal = eligible.reduce((sum, l) => sum + l.totalCents, 0);
  if (eligibleTotal <= 0) return allocation;

  const totalDiscount = Math.min(promo.discountCents, eligibleTotal);
  let remaining = totalDiscount;
  for (let i = 0; i < eligible.length; i++) {
    const line = eligible[i];
    const isLast = i === eligible.length - 1;
    const share = isLast
      ? remaining
      : Math.floor((totalDiscount * line.totalCents) / eligibleTotal);
    allocation.set(line.courseId, share);
    remaining -= share;
  }
  return allocation;
}

// Finalisation immédiate (panier à 0 €) : crée order PAID + enrollments,
// vide le panier, incrémente totalEnrollments + usedCount du promo.
async function finalizeFreeOrder({
  userId,
  currency,
  subtotalCents,
  lines,
  promo,
  affiliateCode,
  idempotencyKey,
}: {
  userId: string;
  currency: Currency;
  subtotalCents: number;
  lines: CartLineComputation[];
  promo: AppliedPromoSnapshot | null;
  affiliateCode: string | null;
  idempotencyKey: string | null;
}) {
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId,
        status: "PAID",
        paidAt: new Date(),
        currency,
        subtotalCents,
        discountCents: promo?.discountCents ?? subtotalCents,
        totalCents: 0,
        promoCodeId: promo?.promoCodeId ?? null,
        affiliateCode: affiliateCode ?? null,
        idempotencyKey,
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
          source: promo ? "PROMO_FREE" : "PURCHASE",
        },
        create: {
          userId,
          courseId: line.courseId,
          orderItemId: item.id,
          source: promo ? "PROMO_FREE" : "PURCHASE",
        },
      });

      await tx.course.update({
        where: { id: line.courseId },
        data: { totalEnrollments: { increment: 1 } },
      });
    }

    await tx.cartItem.deleteMany({ where: { userId } });

    if (promo) {
      await tx.promoCode.update({
        where: { id: promo.promoCodeId },
        data: { usedCount: { increment: 1 } },
      });
    }
    return created;
  });
  return order;
}
