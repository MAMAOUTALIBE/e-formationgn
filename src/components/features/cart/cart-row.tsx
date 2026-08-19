"use client";

import Image from "next/image";
import Link from "next/link";
import { useTransition } from "react";
import { Heart, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CoursePrice } from "@/components/features/courses/course-price";
import {
  moveCartItemToWishlist,
  removeCourseFromCart,
} from "@/server/actions/cart";
import type { Currency } from "@/generated/prisma/enums";

interface CartRowProps {
  courseId: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  instructorName: string;
  priceEUR: number;
  priceUSD: number;
  discountPriceEUR: number | null;
  discountPriceUSD: number | null;
  currency: Currency;
  badge?: string;
}

export function CartRow({
  courseId,
  slug,
  title,
  thumbnailUrl,
  instructorName,
  priceEUR,
  priceUSD,
  discountPriceEUR,
  discountPriceUSD,
  currency,
  badge,
}: CartRowProps) {
  const [pending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      await removeCourseFromCart(courseId);
    });
  }

  function handleMoveToWishlist() {
    startTransition(async () => {
      await moveCartItemToWishlist(courseId);
    });
  }

  return (
    <li className="flex gap-4 border-b border-border py-4 last:border-b-0">
      <Link
        href={`/cours/${slug}`}
        className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-muted"
        aria-hidden
      >
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={`Vignette de ${title}`}
            fill
            sizes="128px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[color:var(--brand-primary)]/10 via-muted to-[color:var(--brand-accent)]/10 text-[10px] uppercase tracking-wide text-muted-foreground">
            Aiduca
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <Link
          href={`/cours/${slug}`}
          className="line-clamp-2 text-sm font-semibold text-foreground hover:underline"
        >
          {title}
        </Link>
        <p className="text-xs text-muted-foreground">Par {instructorName}</p>
        {badge ? (
          <span className="inline-flex w-fit items-center rounded bg-[color:var(--brand-success)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--brand-success)]">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col items-end justify-between gap-2">
        <CoursePrice
          priceEUR={priceEUR}
          priceUSD={priceUSD}
          discountPriceEUR={discountPriceEUR}
          discountPriceUSD={discountPriceUSD}
          currency={currency}
          size="md"
        />
        <div className="flex flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleMoveToWishlist}
            disabled={pending}
            aria-label={`Garder ${title} pour plus tard`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <Heart className="h-3.5 w-3.5" aria-hidden />
            Plus tard
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={pending}
            aria-label={`Retirer ${title} du panier`}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Retirer
          </Button>
        </div>
      </div>
    </li>
  );
}
