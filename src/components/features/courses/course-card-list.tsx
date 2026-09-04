// Variant LIST horizontal de la CourseCard — pattern Udemy desktop quand
// l'utilisateur préfère la vue liste. Image à gauche (260×147), infos à droite.
//
// Le hover flyout est désactivé en mode liste (la card est déjà large, pas
// besoin d'aperçu supplémentaire qui sortirait du viewport).

import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/stars";
import { getCourseBadges } from "@/lib/courses/badges";
import { resolveCourseCardBackground } from "@/lib/courses/domain-backgrounds";
import { COURSE_LEVEL_LABELS, pluralize } from "@/lib/format/labels";
import { formatDurationFromSeconds } from "@/lib/format/duration";
import type { PublicCourseListItem } from "@/server/queries/courses";

import { CourseBadges } from "./course-badges";

interface CourseCardListProps {
  course: PublicCourseListItem;
}

export function CourseCardList({ course }: CourseCardListProps) {
  const backgroundImage = resolveCourseCardBackground(
    course.category.slug,
    course.thumbnailUrl,
  );
  const instructorName =
    course.instructor.name ??
    ([course.instructor.firstName, course.instructor.lastName].filter(Boolean).join(" ") ||
      "Formateur Aiduca");

  const badges = getCourseBadges({
    totalEnrollments: course.totalEnrollments,
    averageRating: course.averageRating,
    totalRatings: course.totalRatings,
    publishedAt: course.publishedAt,
    isFeatured: course.isFeatured,
  });

  return (
    <article className="group flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm transition-shadow hover:shadow-md sm:flex-row">
      <Link
        href={`/cours/${course.slug}`}
        className="block shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Voir la formation ${course.title}`}
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted sm:w-[260px]">
          {backgroundImage ? (
            <Image
              src={backgroundImage}
              alt={`Vignette de la formation ${course.title}`}
              fill
              sizes="(min-width: 640px) 260px, 100vw"
              className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[color:var(--brand-primary)]/10 via-muted to-[color:var(--brand-accent)]/10">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Aiduca
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="text-base font-semibold leading-snug text-foreground sm:text-lg">
          <Link href={`/cours/${course.slug}`} className="hover:underline">
            {course.title}
          </Link>
        </h3>

        {course.subtitle ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {course.subtitle}
          </p>
        ) : null}

        <p className="mt-2 text-xs text-muted-foreground">
          Par <span className="text-foreground">{instructorName}</span>
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {/* Cf. course-card.tsx : « 0.0 » se lit comme une mauvaise note. */}
          {course.totalRatings > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Stars
                rating={course.averageRating}
                size="sm"
                totalRatings={course.totalRatings}
              />
              <span className="font-semibold text-foreground">
                {course.averageRating.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">
                ({course.totalRatings})
              </span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Pas encore d&apos;avis</span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDurationFromSeconds(course.durationSeconds)} ·{" "}
            {course.totalEnrollments.toLocaleString("fr-FR")}{" "}
            {pluralize(course.totalEnrollments, "élève", "élèves")}
          </span>
        </div>

        {badges.length > 0 ? <CourseBadges badges={badges} className="mt-2" /> : null}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {course.category.name}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {COURSE_LEVEL_LABELS[course.level]}
          </Badge>
        </div>
      </div>

    </article>
  );
}
