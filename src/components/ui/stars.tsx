import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface StarsProps {
  rating: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  showLabel?: boolean;
  // Si fourni, enrichit l'aria-label : « Noté 4,5 sur 5 par 243 avis ».
  // Donne au lecteur d'écran le contexte (popularité) plutôt qu'un chiffre nu.
  totalRatings?: number;
}

const SIZE_CLASSES = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
} as const;

export function Stars({
  rating,
  size = "md",
  className,
  showLabel,
  totalRatings,
}: StarsProps) {
  const clamped = Math.max(0, Math.min(5, rating));
  const rounded = Math.round(clamped * 2) / 2; // demi-étoiles
  const cls = SIZE_CLASSES[size];
  const ratingFr = clamped.toFixed(1).replace(".", ",");
  const ariaLabel =
    totalRatings && totalRatings > 0
      ? `Noté ${ratingFr} sur 5 par ${totalRatings.toLocaleString("fr-FR")} ${
          totalRatings > 1 ? "avis" : "avis"
        }`
      : `Noté ${ratingFr} sur 5`;

  return (
    <span
      className={cn("inline-flex items-center gap-1 text-[color:var(--brand-warning)]", className)}
      role="img"
      aria-label={ariaLabel}
    >
      <span className="inline-flex">
        {[0, 1, 2, 3, 4].map((index) => {
          const filled = rounded - index;
          return (
            <span key={index} className="relative inline-block" aria-hidden>
              <Star className={cn(cls, "text-muted-foreground/30")} />
              {filled > 0 ? (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${Math.min(1, filled) * 100}%` }}
                >
                  <Star className={cn(cls, "fill-current text-[color:var(--brand-warning)]")} />
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
      {showLabel ? (
        <span className="text-sm font-medium text-foreground">{clamped.toFixed(1)}</span>
      ) : null}
    </span>
  );
}
