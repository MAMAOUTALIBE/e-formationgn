import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { CardWishlistButton } from "@/components/features/wishlist/card-wishlist-button";
import type { Currency } from "@/generated/prisma/enums";
import { getCourseBadges } from "@/lib/courses/badges";
import { pluralize } from "@/lib/format/labels";
import type { PublicCourseListItem } from "@/server/queries/courses";

import { CourseBadges } from "./course-badges";
import { CourseCardHoverFlyout } from "./course-card-hover-flyout";
import { isTrainingCenterMode } from "@/lib/platform-mode";

import { CoursePrice } from "./course-price";

interface CourseCardProps {
  course: PublicCourseListItem;
  currency?: Currency;
  /** Côté d'apparition du flyout hover (desktop). "left" pour la dernière colonne. */
  flyoutSide?: "left" | "right";
  /** Désactive le flyout (utile dans les pages où il gênerait : page formateur, wishlist). */
  hideFlyout?: boolean;
  /** Cible du lien principal (par défaut /cours/[slug]) — ex : URL avec ?ref=. */
  href?: string;
}

// Carte de cours au format Udemy : image 16:9 (réf. 480×270), badge en
// overlay, puis titre → formateur → rangée de pastilles (Meilleure vente /
// type / note / avis) → prix. Compacte. Les infos détaillées (sous-titre,
// durée, niveau…) restent sur le flyout hover et la fiche du cours.
export function CourseCard({
  course,
  currency = "EUR",
  flyoutSide = "right",
  hideFlyout,
  href,
}: CourseCardProps) {
  const courseHref = href ?? `/cours/${course.slug}`;
  const instructorName =
    course.instructor.name ??
    ([course.instructor.firstName, course.instructor.lastName].filter(Boolean).join(" ") ||
      "Formateur Gandal");

  const badges = getCourseBadges({
    totalEnrollments: course.totalEnrollments,
    averageRating: course.averageRating,
    totalRatings: course.totalRatings,
    publishedAt: course.publishedAt,
    isFeatured: course.isFeatured,
  });

  // % de réduction (devise active) pour le badge promo.
  const price = currency === "USD" ? Number(course.priceUSD) : Number(course.priceEUR);
  const discount =
    currency === "USD" ? course.discountPriceUSD : course.discountPriceEUR;
  const discountPct =
    discount != null && price > 0 && Number(discount) < price
      ? Math.round((1 - Number(discount) / price) * 100)
      : null;

  return (
    <article className="group/card relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {course.thumbnailUrl ? (
          <Image
            src={course.thumbnailUrl}
            alt={`Vignette de la formation ${course.title}`}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-200 group-hover/card:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[color:var(--brand-primary)]/10 via-muted to-[color:var(--brand-accent)]/10">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Gandal
            </span>
          </div>
        )}
      </div>

      {/* Overlays sur l'image (z-10/20 pour rester au-dessus du lien étiré). */}
      <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-col items-start gap-1">
        {badges.length > 0 ? <CourseBadges badges={badges.slice(0, 1)} /> : null}
        {discountPct != null ? (
          <span className="rounded bg-[color:var(--brand-danger)] px-1.5 py-0.5 text-[10px] font-bold text-white">
            -{discountPct}%
          </span>
        ) : null}
      </div>
      <CardWishlistButton
        courseId={course.id}
        className="absolute right-2 top-2 z-20"
      />

      <div className="flex flex-1 flex-col p-3">
        {/* Lien étiré : toute la carte mène au cours (after:inset-0). */}
        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground">
          <Link
            href={courseHref}
            aria-label={`Voir la formation ${course.title}`}
            className="after:absolute after:inset-0 after:z-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {course.title}
          </Link>
        </h3>

        {course.instructor.affiliateCode ? (
          <Link
            href={`/formateurs/${course.instructor.affiliateCode}`}
            className="relative z-10 mt-1 block w-fit max-w-full truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            {instructorName}
          </Link>
        ) : (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {instructorName}
          </p>
        )}

        {/* Rangée de pastilles (une ligne, compacte façon Udemy) :
            Formation · ★ note · N avis. Le badge marketing est en overlay sur
            l'image. Note et avis pointent vers la section avis (z-10 pour
            rester cliquables au-dessus du lien étiré). */}
        <div className="relative z-10 mt-2 flex w-fit max-w-full flex-wrap items-center gap-1">
          <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Formation
          </span>
          <Link
            href={`/cours/${course.slug}#reviews`}
            aria-label={`Voir les avis — note ${course.averageRating.toFixed(1)} sur 5`}
            className="inline-flex items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-foreground hover:border-[color:var(--brand-warning)]"
          >
            <Star className="h-3 w-3 fill-[color:var(--brand-warning)] text-[color:var(--brand-warning)]" />
            {course.averageRating.toFixed(1)}
          </Link>
          <Link
            href={`/cours/${course.slug}#reviews`}
            className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            {course.totalRatings.toLocaleString("fr-FR")}{" "}
            {pluralize(course.totalRatings, "avis", "avis")}
          </Link>
        </div>

        {/* Centre de formation : le bloc prix n'est pas rendu du tout. Le
            masquer en CSS le laisserait lisible dans le HTML — un prix qui
            n'a plus cours n'a pas à figurer dans la page. */}
        {isTrainingCenterMode() ? null : (
        <div className="mt-auto pt-3">
          <CoursePrice
            priceEUR={Number(course.priceEUR)}
            priceUSD={Number(course.priceUSD)}
            discountPriceEUR={course.discountPriceEUR != null ? Number(course.discountPriceEUR) : null}
            discountPriceUSD={course.discountPriceUSD != null ? Number(course.discountPriceUSD) : null}
            currency={currency}
            size="md"
          />
        </div>
        )}
      </div>

      {hideFlyout ? null : (
        <CourseCardHoverFlyout course={course} side={flyoutSide} trainingCenter={isTrainingCenterMode()} />
      )}
    </article>
  );
}
