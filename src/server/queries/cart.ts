// Queries du panier — calcul des totaux, application d'un code promo,
// détection si chaque cours est éligible au taux d'affiliation 15 %.

import type { Prisma } from "@/generated/prisma/client";
import type { Currency } from "@/generated/prisma/enums";
import { amountToCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { DEFAULT_COMMISSION_RATES } from "@/lib/commission";

const CART_ITEM_INCLUDE = {
  course: {
    select: {
      id: true,
      slug: true,
      title: true,
      thumbnailUrl: true,
      priceEUR: true,
      priceUSD: true,
      priceGNF: true,
      priceXOF: true,
      discountPriceEUR: true,
      discountPriceUSD: true,
      discountPriceGNF: true,
      discountPriceXOF: true,
      discountEndsAt: true,
      status: true,
      instructorId: true,
      categoryId: true,
      instructor: {
        select: { id: true, name: true, firstName: true, affiliateCode: true },
      },
    },
  },
} satisfies Prisma.CartItemInclude;

export type CartItemRow = Prisma.CartItemGetPayload<{
  include: typeof CART_ITEM_INCLUDE;
}>;

export async function listCartItems(userId: string): Promise<CartItemRow[]> {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: CART_ITEM_INCLUDE,
    orderBy: { addedAt: "desc" },
  });
  return items as CartItemRow[];
}

export interface CartLineComputation {
  courseId: string;
  instructorId: string;
  unitPriceCents: number;
  discountCents: number;
  totalCents: number;
  isInstructorDriven: boolean;
}

interface ComputeCartTotalsParams {
  items: CartItemRow[];
  currency: Currency;
  affiliateCode: string | null;
}

interface ComputeCartTotalsResult {
  lines: CartLineComputation[];
  subtotalCents: number;
}

export function computeCartLines({
  items,
  currency,
  affiliateCode,
}: ComputeCartTotalsParams): ComputeCartTotalsResult {
  const now = Date.now();
  const lines: CartLineComputation[] = [];
  let subtotal = 0;

  for (const item of items) {
    const course = item.course;
    if (!course) continue;
    if (course.status !== "PUBLISHED") continue;

    // Sélectionne la paire de prix correspondant à la devise du panier.
    let fullPrice: number;
    let discount: Prisma.Decimal | null;
    switch (currency) {
      case "USD":
        fullPrice = Number(course.priceUSD);
        discount = course.discountPriceUSD;
        break;
      case "GNF":
        fullPrice = Number(course.priceGNF);
        discount = course.discountPriceGNF;
        break;
      case "XOF":
        fullPrice = Number(course.priceXOF);
        discount = course.discountPriceXOF;
        break;
      case "EUR":
      default:
        fullPrice = Number(course.priceEUR);
        discount = course.discountPriceEUR;
        break;
    }

    const discountActive =
      discount !== null &&
      discount !== undefined &&
      Number(discount) < fullPrice &&
      (course.discountEndsAt === null ||
        course.discountEndsAt === undefined ||
        course.discountEndsAt.getTime() > now);

    const unitCents = amountToCents(fullPrice, currency);
    const discountCents = discountActive
      ? unitCents - amountToCents(Number(discount), currency)
      : 0;
    const totalCents = unitCents - discountCents;

    const isInstructorDriven =
      affiliateCode !== null &&
      course.instructor.affiliateCode !== null &&
      course.instructor.affiliateCode === affiliateCode;

    lines.push({
      courseId: course.id,
      instructorId: course.instructorId,
      unitPriceCents: unitCents,
      discountCents,
      totalCents,
      isInstructorDriven,
    });
    subtotal += totalCents;
  }

  return { lines, subtotalCents: subtotal };
}

// ----------------------------------------------------------------------------
// Promo codes
// ----------------------------------------------------------------------------

export interface AppliedPromo {
  promoCodeId: string;
  code: string;
  discountCents: number;
  // Si renseigné : code créé par ce formateur — la remise sera imputée à sa
  // part dans le calcul de commission (cf. checkout.ts).
  instructorId: string | null;
  message: string;
}

interface ApplyPromoParams {
  code: string;
  currency: Currency;
  subtotalCents: number;
  cart: Array<{ courseId: string; instructorId: string }>;
}

export async function tryApplyPromo({
  code,
  currency,
  subtotalCents,
  cart,
}: ApplyPromoParams): Promise<
  { ok: true; promo: AppliedPromo } | { ok: false; message: string }
> {
  const promo = await prisma.promoCode.findUnique({
    where: { code },
    include: { courses: { select: { courseId: true } } },
  });
  if (!promo || !promo.isActive) {
    return { ok: false, message: "Code promo inconnu ou désactivé." };
  }

  const now = Date.now();
  if (promo.startsAt && promo.startsAt.getTime() > now) {
    return { ok: false, message: "Ce code n'est pas encore actif." };
  }
  if (promo.endsAt && promo.endsAt.getTime() < now) {
    return { ok: false, message: "Ce code a expiré." };
  }
  if (promo.maxRedemptions !== null && promo.usedCount >= promo.maxRedemptions) {
    return { ok: false, message: "Ce code a atteint sa limite d'utilisations." };
  }

  // Code formateur : tous les cours du panier doivent lui appartenir.
  // Cette contrainte garantit que la remise est entièrement imputable sur
  // la part du formateur (pas de subvention croisée entre formateurs).
  if (promo.instructorId) {
    const cartInstructors = new Set(cart.map((c) => c.instructorId));
    if (cartInstructors.size !== 1 || !cartInstructors.has(promo.instructorId)) {
      return {
        ok: false,
        message:
          "Ce code n'est applicable que sur un panier composé exclusivement de formations de son formateur.",
      };
    }
  }

  if (promo.scope === "COURSE_SPECIFIC") {
    const allowed = new Set(promo.courses.map((c) => c.courseId));
    const eligibleSubtotal = cart.some((c) => allowed.has(c.courseId));
    if (!eligibleSubtotal) {
      return {
        ok: false,
        message: "Ce code n'est pas applicable aux formations présentes dans votre panier.",
      };
    }
  }

  if (promo.kind === "FIXED_AMOUNT") {
    if (promo.currency && promo.currency !== currency) {
      return {
        ok: false,
        message: `Ce code n'est utilisable qu'en ${promo.currency}.`,
      };
    }
    const discount = Math.min(promo.value, subtotalCents);
    return {
      ok: true,
      promo: {
        promoCodeId: promo.id,
        code: promo.code,
        discountCents: discount,
        instructorId: promo.instructorId,
        message: "Code appliqué.",
      },
    };
  }

  // PERCENTAGE — value en bps (1500 = 15 %)
  const discount = Math.floor((subtotalCents * promo.value) / 10_000);
  return {
    ok: true,
    promo: {
      promoCodeId: promo.id,
      code: promo.code,
      discountCents: Math.min(discount, subtotalCents),
      instructorId: promo.instructorId,
      message: "Code appliqué.",
    },
  };
}

// ----------------------------------------------------------------------------
// Compteur d'items pour le badge dans le header
// ----------------------------------------------------------------------------

export async function countCartItems(userId: string): Promise<number> {
  return prisma.cartItem.count({ where: { userId } });
}

export async function isUserEnrolledIn(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  return Boolean(enrollment);
}

// On expose les taux par défaut pour usage côté serveur.
export { DEFAULT_COMMISSION_RATES };
