"use client";

import { Heart } from "lucide-react";
import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import { toggleWishlist } from "@/server/actions/wishlist";

interface CardWishlistButtonProps {
  courseId: string;
  className?: string;
  initialActive?: boolean;
}

// Cœur compact (icône seule) pour l'overlay des cartes de cours. Réutilise
// toggleWishlist. preventDefault pour ne pas déclencher le lien de la carte.
export function CardWishlistButton({
  courseId,
  className,
  initialActive = false,
}: CardWishlistButtonProps) {
  const [active, setActive] = useState(initialActive);
  const [pending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setActive((v) => !v); // optimiste
    startTransition(async () => {
      const result = await toggleWishlist(courseId);
      if (!result.success) setActive((v) => !v); // rollback
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={active}
      aria-label={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full bg-card/90 shadow-sm ring-1 ring-border backdrop-blur transition hover:bg-card",
        active ? "text-[color:var(--brand-danger)]" : "text-foreground",
        className,
      )}
    >
      <Heart className="h-4 w-4" fill={active ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
