"use server";

// Validation d'un code promo dans le contexte d'un cours unique (page détail).
// Permet à l'utilisateur de vérifier que son code est valide AVANT d'ajouter
// le cours au panier — pattern Udemy « Apply coupon » sur la page cours.
//
// La logique business (expiration, scope COURSE_SPECIFIC, contraintes
// instructeur, contraintes devise) est exactement celle de
// `tryApplyPromo` (lib panier) — on délègue pour rester DRY.

import { amountToMinor, formatMinor } from "@/lib/payments/currency";
import { prisma } from "@/lib/prisma";
import { promoCodeSchema } from "@/lib/validators/checkout";
import { tryApplyPromo } from "@/server/queries/cart";
import type { Currency } from "@/generated/prisma/enums";

export interface PreviewPromoResult {
  ok: boolean;
  /** Message à afficher à l'utilisateur (succès ou erreur). */
  message: string;
  /** Code normalisé tel qu'à stocker (sessionStorage) — uniquement si ok. */
  code?: string;
  /** Montant économisé, formaté en string utilisateur. */
  discountFormatted?: string;
  /** Nouveau prix après remise, formaté. */
  finalPriceFormatted?: string;
}

export async function previewCoursePromo(input: {
  courseId: string;
  code: string;
  currency: Currency;
}): Promise<PreviewPromoResult> {
  const parsedCode = promoCodeSchema.safeParse({ code: input.code });
  if (!parsedCode.success) {
    return { ok: false, message: "Code promo invalide." };
  }

  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: {
      id: true,
      instructorId: true,
      status: true,
      priceEUR: true,
      priceUSD: true,
      priceGNF: true,
      priceXOF: true,
      discountPriceEUR: true,
      discountPriceUSD: true,
      discountPriceGNF: true,
      discountPriceXOF: true,
      discountEndsAt: true,
    },
  });
  if (!course || course.status !== "PUBLISHED") {
    return { ok: false, message: "Ce cours n'est pas disponible." };
  }

  // Prix de référence pour le calcul = prix actuel (avec remise éventuelle déjà active).
  const now = Date.now();
  const promoActive =
    course.discountEndsAt === null || course.discountEndsAt.getTime() > now;

  let baseAmount: number;
  switch (input.currency) {
    case "USD":
      baseAmount = Number(
        promoActive && course.discountPriceUSD ? course.discountPriceUSD : course.priceUSD,
      );
      break;
    case "GNF":
      baseAmount = Number(
        promoActive && course.discountPriceGNF ? course.discountPriceGNF : course.priceGNF,
      );
      break;
    case "XOF":
      baseAmount = Number(
        promoActive && course.discountPriceXOF ? course.discountPriceXOF : course.priceXOF,
      );
      break;
    case "EUR":
    default:
      baseAmount = Number(
        promoActive && course.discountPriceEUR ? course.discountPriceEUR : course.priceEUR,
      );
      break;
  }
  const baseMinor = amountToMinor(baseAmount, input.currency);

  if (baseMinor <= 0) {
    return { ok: false, message: "Ce cours est déjà gratuit, aucun code à appliquer." };
  }

  // Délègue à la fonction commune — même checks que le checkout réel.
  const result = await tryApplyPromo({
    code: parsedCode.data.code,
    currency: input.currency,
    subtotalCents: baseMinor,
    cart: [{ courseId: course.id, instructorId: course.instructorId }],
  });

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const finalMinor = Math.max(0, baseMinor - result.promo.discountCents);

  return {
    ok: true,
    message: `Code « ${result.promo.code} » valide ✓ — pensez à le saisir au panier.`,
    code: result.promo.code,
    discountFormatted: formatMinor(result.promo.discountCents, input.currency),
    finalPriceFormatted: formatMinor(finalMinor, input.currency),
  };
}
