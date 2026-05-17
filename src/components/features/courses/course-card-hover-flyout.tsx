"use client";

// Flyout latéral apparaissant au hover d'une CourseCard — pattern Udemy.
// Visible uniquement desktop (lg:block) + group-hover. Sur mobile/tablette,
// le hover n'existe pas (touch), donc le composant ne rend rien d'utile.
//
// Contenu : aperçu enrichi pour aider à décider sans cliquer :
//   - titre (gros)
//   - meta (durée, niveau, dernière mise à jour)
//   - "Ce que vous apprendrez" — top 4 bullets
//   - boutons Ajouter au panier + Wishlist
//   - lien "Voir le détail"
//
// Position : `right` par défaut, `left` si la carte est dans la dernière
// colonne du grid (sinon le flyout sort de l'écran). Le CourseGrid pilote
// via la prop `side` (calcul d'index modulo 3).

import { Heart, ShoppingCart, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDurationFromSeconds } from "@/lib/format/duration";
import { COURSE_LEVEL_LABELS } from "@/lib/format/labels";
import type { PublicCourseListItem } from "@/server/queries/courses";
import { addCourseToCart } from "@/server/actions/cart";
import { toggleWishlist } from "@/server/actions/wishlist";

const fullDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

interface CourseCardHoverFlyoutProps {
  course: PublicCourseListItem;
  side?: "left" | "right";
}

export function CourseCardHoverFlyout({
  course,
  side = "right",
}: CourseCardHoverFlyoutProps) {
  const [pending, startTransition] = useTransition();
  const bullets = course.whatYouWillLearn.slice(0, 4);
  // updatedAt peut arriver en string (sérialisation client) ou Date (rare ici
  // mais robuste). Normalise pour Intl.DateTimeFormat.
  const lastUpdated = fullDateFormatter.format(
    typeof course.updatedAt === "string" ? new Date(course.updatedAt) : course.updatedAt,
  );

  function handleAddToCart() {
    startTransition(() => {
      void addCourseToCart(course.id);
    });
  }

  function handleToggleWishlist() {
    startTransition(() => {
      void toggleWishlist(course.id);
    });
  }

  return (
    <div
      // Caché par défaut, visible quand le parent .group-hover s'active.
      // hidden lg:group-hover/card:block → seulement desktop, sur hover du group nommé "card".
      className={cn(
        "pointer-events-none absolute top-0 z-40 hidden w-[320px] rounded-lg border border-border bg-card p-5 text-card-foreground shadow-2xl ring-1 ring-black/5 lg:group-hover/card:pointer-events-auto lg:group-hover/card:block",
        side === "right" ? "left-full ml-3" : "right-full mr-3",
      )}
      role="dialog"
      aria-label={`Aperçu : ${course.title}`}
    >
      {/* Petite flèche pointant vers la carte */}
      <span
        aria-hidden
        className={cn(
          "absolute top-6 h-3 w-3 rotate-45 border bg-card",
          side === "right"
            ? "-left-1.5 border-b-0 border-r-0 border-border"
            : "-right-1.5 border-l-0 border-t-0 border-border",
        )}
      />

      <h3 className="text-base font-semibold leading-snug text-foreground">
        {course.title}
      </h3>

      <p className="mt-1.5 text-xs text-muted-foreground">
        Mis à jour en {lastUpdated} ·{" "}
        {formatDurationFromSeconds(course.durationSeconds)} ·{" "}
        {COURSE_LEVEL_LABELS[course.level]}
      </p>

      {course.subtitle ? (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-foreground">
          {course.subtitle}
        </p>
      ) : null}

      {bullets.length > 0 ? (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
            <Sparkles className="h-3 w-3 text-[color:var(--brand-secondary)]" aria-hidden />
            Ce que vous apprendrez
          </p>
          <ul className="mt-2 space-y-1.5">
            {bullets.map((bullet, i) => (
              <li
                key={i}
                className="flex gap-2 text-xs leading-snug text-foreground"
              >
                <span
                  aria-hidden
                  className="mt-0.5 text-[color:var(--brand-success)]"
                >
                  ✓
                </span>
                <span className="line-clamp-2">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <Button
          type="button"
          size="sm"
          onClick={handleAddToCart}
          disabled={pending}
          className="w-full"
        >
          <ShoppingCart className="h-4 w-4" aria-hidden />
          Ajouter au panier
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleToggleWishlist}
          disabled={pending}
          aria-label="Ajouter à la wishlist"
        >
          <Heart className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <Link
        href={`/cours/${course.slug}`}
        className="mt-2 block text-center text-xs font-medium text-[color:var(--brand-secondary)] hover:underline"
      >
        Voir le détail du cours →
      </Link>
    </div>
  );
}
