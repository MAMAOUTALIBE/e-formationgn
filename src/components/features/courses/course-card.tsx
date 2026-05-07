import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/stars";
import type { Currency } from "@/generated/prisma/enums";
import { COURSE_LEVEL_LABELS, pluralize } from "@/lib/format/labels";
import { formatDurationFromSeconds } from "@/lib/format/duration";
import type { PublicCourseListItem } from "@/server/queries/courses";

import { CoursePrice } from "./course-price";

interface CourseCardProps {
  course: PublicCourseListItem;
  currency?: Currency;
}

export function CourseCard({ course, currency = "EUR" }: CourseCardProps) {
  const instructorName =
    course.instructor.name ??
    ([course.instructor.firstName, course.instructor.lastName].filter(Boolean).join(" ") ||
      "Formateur E-FormationGN");

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md">
      <Link
        href={`/cours/${course.slug}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Voir le cours ${course.title}`}
      >
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {course.thumbnailUrl ? (
            <Image
              src={course.thumbnailUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[color:var(--brand-primary)]/10 via-muted to-[color:var(--brand-accent)]/10">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                E-FormationGN
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {course.category.name}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {COURSE_LEVEL_LABELS[course.level]}
          </Badge>
        </div>

        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          <Link href={`/cours/${course.slug}`} className="hover:underline">
            {course.title}
          </Link>
        </h3>

        {course.subtitle ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{course.subtitle}</p>
        ) : null}

        <p className="mt-2 text-xs text-muted-foreground">
          Par <span className="text-foreground">{instructorName}</span>
        </p>

        <div className="mt-2 flex items-center gap-2 text-xs">
          <Stars rating={course.averageRating} size="sm" />
          <span className="font-medium text-foreground">{course.averageRating.toFixed(1)}</span>
          <span className="text-muted-foreground">
            ({course.totalRatings} {pluralize(course.totalRatings, "avis", "avis")})
          </span>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          {formatDurationFromSeconds(course.durationSeconds)} ·{" "}
          {course.totalEnrollments.toLocaleString("fr-FR")}{" "}
          {pluralize(course.totalEnrollments, "élève", "élèves")}
        </p>

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
      </div>
    </article>
  );
}
