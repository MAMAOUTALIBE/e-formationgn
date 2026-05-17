// « Featured Review » — un avis mis en avant en grand format au-dessus
// de la liste paginée. Pattern Udemy : crée un point d'ancrage social fort
// (visage + citation) sans noyer le visiteur dans la liste complète.
//
// Sélection algorithmique côté serveur (cf. getFeaturedReview) : pas de
// champ `isFeatured` côté Review pour l'instant — règle = top rating récent.

import { Quote } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Stars } from "@/components/ui/stars";

interface FeaturedReviewProps {
  review: {
    id: string;
    rating: number;
    title: string | null;
    comment: string | null;
    createdAt: Date;
    user: {
      id: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      image: string | null;
    };
  };
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

export function CourseFeaturedReview({ review }: FeaturedReviewProps) {
  const name =
    review.user.name ??
    ([review.user.firstName, review.user.lastName].filter(Boolean).join(" ") ||
      "Élève");
  const initials = name[0]?.toUpperCase() ?? "?";

  return (
    <figure className="relative overflow-hidden rounded-lg border border-border bg-gradient-to-br from-[color:var(--brand-primary)]/5 via-card to-[color:var(--brand-accent)]/5 p-6 shadow-sm">
      <Quote
        className="absolute right-5 top-5 h-10 w-10 text-[color:var(--brand-primary)]/15"
        aria-hidden
      />

      <div className="flex items-start gap-4">
        <Avatar src={review.user.image} alt={name} fallback={initials} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{name}</p>
          <div className="mt-1 flex items-center gap-2">
            <Stars rating={review.rating} size="sm" />
            <span className="text-xs text-muted-foreground">
              · {dateFormatter.format(review.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {review.title ? (
        <p className="mt-4 text-base font-semibold text-foreground">{review.title}</p>
      ) : null}

      <blockquote className="mt-2">
        <p className="whitespace-pre-line text-base italic leading-7 text-foreground">
          « {review.comment} »
        </p>
      </blockquote>

      <figcaption className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
        Avis mis en avant
      </figcaption>
    </figure>
  );
}
