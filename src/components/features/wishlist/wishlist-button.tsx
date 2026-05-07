"use client";

import { Heart } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { toggleWishlist } from "@/server/actions/wishlist";

interface WishlistButtonProps {
  courseId: string;
  className?: string;
  fullWidth?: boolean;
  initialActive?: boolean;
}

export function WishlistButton({
  courseId,
  className,
  fullWidth,
  initialActive = false,
}: WishlistButtonProps) {
  const [active, setActive] = useState(initialActive);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    // Optimisme : on flippe immédiatement.
    setActive((current) => !current);
    startTransition(async () => {
      const result = await toggleWishlist(courseId);
      if (!result.success) {
        // rollback
        setActive((current) => !current);
        setError(result.message ?? "Action impossible.");
      }
    });
  }

  return (
    <div className={fullWidth ? "w-full" : undefined}>
      <Button
        type="button"
        variant="outline"
        className={`${fullWidth ? "w-full" : ""} ${className ?? ""}`}
        onClick={handleClick}
        aria-pressed={active}
        disabled={pending}
      >
        <Heart
          className="h-4 w-4"
          aria-hidden
          fill={active ? "currentColor" : "none"}
        />
        {active ? "Dans la liste de souhaits" : "Ajouter à la wishlist"}
      </Button>
      {error ? (
        <p className="mt-2 text-xs text-destructive" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
