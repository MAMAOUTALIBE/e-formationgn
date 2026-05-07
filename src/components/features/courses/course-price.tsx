import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/money";

import type { Currency } from "@/generated/prisma/enums";

interface CoursePriceProps {
  priceEUR: number; // prix actuel (en euros, pas en cents)
  priceUSD: number;
  discountPriceEUR?: number | null;
  discountPriceUSD?: number | null;
  currency?: Currency;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
} as const;

export function CoursePrice({
  priceEUR,
  priceUSD,
  discountPriceEUR,
  discountPriceUSD,
  currency = "EUR",
  className,
  size = "md",
}: CoursePriceProps) {
  const fullPrice = currency === "USD" ? priceUSD : priceEUR;
  const discounted = currency === "USD" ? discountPriceUSD : discountPriceEUR;

  if (fullPrice === 0) {
    return (
      <span className={cn("font-semibold text-[color:var(--brand-success)]", SIZE_CLASSES[size], className)}>
        Gratuit
      </span>
    );
  }

  if (discounted !== null && discounted !== undefined && discounted < fullPrice) {
    return (
      <span className={cn("inline-flex items-baseline gap-2", className)}>
        <span className={cn("font-semibold text-foreground", SIZE_CLASSES[size])}>
          {formatPrice(discounted, currency)}
        </span>
        <span className="text-xs text-muted-foreground line-through">
          {formatPrice(fullPrice, currency)}
        </span>
      </span>
    );
  }

  return (
    <span className={cn("font-semibold text-foreground", SIZE_CLASSES[size], className)}>
      {formatPrice(fullPrice, currency)}
    </span>
  );
}
