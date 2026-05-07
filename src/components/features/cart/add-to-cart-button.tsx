"use client";

import { ShoppingCart, Check } from "lucide-react";
import Link from "next/link";
import { useTransition, useState } from "react";

import { Button } from "@/components/ui/button";
import { addCourseToCart } from "@/server/actions/cart";

interface AddToCartButtonProps {
  courseId: string;
  className?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "lg";
  fullWidth?: boolean;
  label?: string;
  /** L'élève est-il déjà inscrit à ce cours ? */
  alreadyEnrolled?: boolean;
  /** Le cours est-il déjà au panier ? */
  alreadyInCart?: boolean;
}

export function AddToCartButton({
  courseId,
  className,
  variant = "default",
  size = "default",
  fullWidth = true,
  label = "Ajouter au panier",
  alreadyEnrolled,
  alreadyInCart,
}: AddToCartButtonProps) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(
    null,
  );
  const [optimisticInCart, setOptimisticInCart] = useState(Boolean(alreadyInCart));

  if (alreadyEnrolled) {
    return (
      <Button asChild variant="outline" className={`${fullWidth ? "w-full" : ""} ${className ?? ""}`}>
        <Link href="/apprentissage">
          <Check className="h-4 w-4" aria-hidden />
          Vous y êtes inscrit
        </Link>
      </Button>
    );
  }

  if (optimisticInCart) {
    return (
      <Button asChild className={`${fullWidth ? "w-full" : ""} ${className ?? ""}`}>
        <Link href="/panier">
          <ShoppingCart className="h-4 w-4" aria-hidden />
          Voir mon panier
        </Link>
      </Button>
    );
  }

  function handleClick() {
    setFeedback(null);
    startTransition(async () => {
      const result = await addCourseToCart(courseId);
      if (result.success) {
        setOptimisticInCart(true);
      } else {
        setFeedback({
          kind: "error",
          message: result.message ?? "Impossible d'ajouter au panier.",
        });
      }
    });
  }

  return (
    <div className={fullWidth ? "w-full" : undefined}>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={`${fullWidth ? "w-full" : ""} ${className ?? ""}`}
        onClick={handleClick}
        disabled={pending}
      >
        <ShoppingCart className="h-4 w-4" aria-hidden />
        {pending ? "Ajout…" : label}
      </Button>
      {feedback ? (
        <p
          className={`mt-2 text-xs ${feedback.kind === "ok" ? "text-[color:var(--brand-success)]" : "text-destructive"}`}
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
