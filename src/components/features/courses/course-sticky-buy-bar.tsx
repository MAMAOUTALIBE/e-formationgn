// Barre fixe en bas d'écran mobile (< lg) avec prix + CTA — visible pendant
// tout le scroll de la page cours. Cachée sur desktop où la sticky card de
// droite assure déjà cette fonction.
//
// Server Component qui délègue le bouton à AddToCartButton (client-side).
// Le composant reste fin : il sert d'enveloppe sticky, rien de plus.

import { AddToCartButton } from "@/components/features/cart/add-to-cart-button";
import { CoursePrice } from "@/components/features/courses/course-price";
import type { Currency } from "@/generated/prisma/enums";

interface CourseStickyBuyBarProps {
  courseId: string;
  priceEUR: number;
  priceUSD: number;
  discountPriceEUR?: number | null;
  discountPriceUSD?: number | null;
  currency: Currency;
  alreadyEnrolled: boolean;
  alreadyInCart: boolean;
}

export function CourseStickyBuyBar({
  courseId,
  priceEUR,
  priceUSD,
  discountPriceEUR,
  discountPriceUSD,
  currency,
  alreadyEnrolled,
  alreadyInCart,
}: CourseStickyBuyBarProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden"
      role="region"
      aria-label="Inscription à la formation"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-shrink">
          <CoursePrice
            priceEUR={priceEUR}
            priceUSD={priceUSD}
            discountPriceEUR={discountPriceEUR}
            discountPriceUSD={discountPriceUSD}
            currency={currency}
            size="md"
          />
        </div>
        <div className="shrink-0">
          <AddToCartButton
            courseId={courseId}
            alreadyEnrolled={alreadyEnrolled}
            alreadyInCart={alreadyInCart}
          />
        </div>
      </div>
    </div>
  );
}
