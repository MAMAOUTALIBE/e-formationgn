import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/stars";
import type { Currency } from "@/generated/prisma/enums";
import { getCourseBadges } from "@/lib/courses/badges";
import { COURSE_LEVEL_LABELS, pluralize } from "@/lib/format/labels";
import { formatDurationFromSeconds } from "@/lib/format/duration";
import type { PublicCourseListItem } from "@/server/queries/courses";

import { CourseBadges } from "./course-badges";
import { CourseCardHoverFlyout } from "./course-card-hover-flyout";
import { CoursePrice } from "./course-price";

interface CourseCardProps {
  course: PublicCourseListItem;
  currency?: Currency;
  /** Côté d'apparition du flyout hover (desktop). "left" pour la dernière colonne. */
  flyoutSide?: "left" | "right";
  /** Désactive le flyout (utile dans les pages où il gênerait : page formateur, wishlist). */
  hideFlyout?: boolean;
}

export function CourseCard({
  course,
  currency = "EUR",
  flyoutSide = "right",
  hideFlyout,
}: CourseCardProps) {
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

  return (
    <article className="group/card relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/cours/${course.slug}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Voir le cours ${course.title}`}
      >
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt={`Vignette du cours ${course.title}`}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
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
      </Link>

      <div className="flex flex-1 flex-col p-5">
        {badges.length > 0 ? (
          <CourseBadges badges={badges} className="mb-2" />
        ) : null}

        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px]">
            {course.category.name}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {COURSE_LEVEL_LABELS[course.level]}
          </Badge>
        </div>

        <h3 className="line-clamp-2 text-base font-bold leading-snug text-foreground">
          <Link href={`/cours/${course.slug}`} className="hover:underline">
            {course.title}
          </Link>
        </h3>

        {/* Headline marketing : sous-titre mis en avant à la Udemy (italic
            léger, foreground vs muted, line-clamp 2) — donne un vrai pitch
            de vente plutôt qu'un descriptif technique discret. */}
        {course.subtitle ? (
          <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-foreground/85">
            {course.subtitle}
          </p>
        ) : null}

        <p className="mt-2 text-xs text-muted-foreground">
          Par <span className="font-medium text-foreground">{instructorName}</span>
        </p>

        <div className="mt-2 flex items-center gap-2 text-sm">
          <Stars
            rating={course.averageRating}
            size="sm"
            totalRatings={course.totalRatings}
          />
          <span className="font-semibold text-foreground">{course.averageRating.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">
            ({course.totalRatings} {pluralize(course.totalRatings, "avis", "avis")})
          </span>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          {formatDurationFromSeconds(course.durationSeconds)} ·{" "}
          {course.totalEnrollments.toLocaleString("fr-FR")}{" "}
          {pluralize(course.totalEnrollments, "élève", "élèves")}
        </p>

        <div className="mt-auto pt-4">
          <CoursePrice
            priceEUR={Number(course.priceEUR)}
            priceUSD={Number(course.priceUSD)}
            discountPriceEUR={course.discountPriceEUR != null ? Number(course.discountPriceEUR) : null}
            discountPriceUSD={course.discountPriceUSD != null ? Number(course.discountPriceUSD) : null}
            currency={currency}
            size="md"
          />
        </div>
      </div>

      {hideFlyout ? null : (
        <CourseCardHoverFlyout course={course} side={flyoutSide} />
      )}
    </article>
  );
}
