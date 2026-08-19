// Histogramme horizontal des notes 5/4/3/2/1, façon Udemy.
// Affiché à côté ou au-dessus de la liste des avis pour donner un aperçu
// rapide de la dispersion (vs juste la moyenne).

import { Star } from "lucide-react";

import { Stars } from "@/components/ui/stars";
import type { RatingDistributionBucket } from "@/server/queries/courses";

interface CourseRatingDistributionProps {
  buckets: RatingDistributionBucket[];
  averageRating: number;
  totalRatings: number;
}

export function CourseRatingDistribution({
  buckets,
  averageRating,
  totalRatings,
}: CourseRatingDistributionProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-[180px_1fr]">
      {/* Score moyen en grand */}
      <div className="flex flex-col items-center justify-center gap-2 text-center sm:items-start sm:text-left">
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-bold tabular-nums text-foreground">
            {averageRating.toFixed(1).replace(".", ",")}
          </span>
          <Star
            className="h-5 w-5 fill-[color:var(--brand-warning)] text-[color:var(--brand-warning)]"
            aria-hidden
          />
        </div>
        <Stars rating={averageRating} size="md" totalRatings={totalRatings} />
        <p className="text-xs font-medium text-muted-foreground">
          Note de la formation
        </p>
      </div>

      {/* Histogramme horizontal */}
      <ul className="space-y-2">
        {buckets.map((bucket) => (
          <li
            key={bucket.rating}
            className="flex items-center gap-3 text-sm"
          >
            <span className="flex w-24 shrink-0 items-center gap-1 text-muted-foreground tabular-nums">
              <span>{bucket.rating}</span>
              <Star
                className="h-3.5 w-3.5 fill-current text-[color:var(--brand-warning)]"
                aria-hidden
              />
            </span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-[color:var(--brand-warning)] transition-[width] duration-300"
                style={{ width: `${bucket.percent}%` }}
                aria-hidden
              />
            </div>
            <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
              {bucket.percent} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
