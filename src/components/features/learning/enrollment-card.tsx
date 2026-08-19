// Card de cours « Mon apprentissage » v2 — affiche la progression
// visuelle (%) + bouton « Reprendre » qui pointe sur la dernière leçon
// active (passé en prop). Si pas de dernière leçon connue, fallback sur
// /apprentissage/[slug] (la page va router vers la 1re leçon).

import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, PlayCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
});

interface EnrollmentCardProps {
  enrollment: {
    id: string;
    enrolledAt: Date;
    progressPercent: number;
    completedAt: Date | null;
    course: {
      slug: string;
      title: string;
      thumbnailUrl: string | null;
      instructor: {
        name: string | null;
        firstName: string | null;
        lastName: string | null;
      };
    };
  };
  /** Lien direct vers la dernière leçon active (si connue). Sinon `/apprentissage/[slug]`. */
  resumeHref?: string;
}

export function EnrollmentCard({ enrollment, resumeHref }: EnrollmentCardProps) {
  const { course } = enrollment;
  const instructorName =
    course.instructor.name ??
    ([course.instructor.firstName, course.instructor.lastName].filter(Boolean).join(" ") ||
      "Formateur");

  const percent = Math.round(enrollment.progressPercent);
  const isCompleted = enrollment.completedAt !== null || percent >= 100;
  const hasStarted = percent > 0;

  const href = resumeHref ?? `/apprentissage/${course.slug}`;
  const ctaLabel = isCompleted
    ? "Revoir la formation"
    : hasStarted
      ? "Reprendre"
      : "Commencer";

  return (
    <Card className="overflow-hidden">
      <Link
        href={`/apprentissage/${course.slug}`}
        className="relative block aspect-video overflow-hidden bg-muted"
      >
        {course.thumbnailUrl ? (
          <Image
            src={course.thumbnailUrl}
            alt={`Vignette de la formation ${course.title}`}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[color:var(--brand-primary)]/10 via-muted to-[color:var(--brand-accent)]/10 text-xs uppercase tracking-wide text-muted-foreground">
            Gandal
          </div>
        )}
        {isCompleted ? (
          <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-success)] px-2 py-1 text-[10px] font-semibold text-white shadow">
            <CheckCircle2 className="h-3 w-3" aria-hidden />
            Terminé
          </div>
        ) : null}
      </Link>

      <CardContent className="space-y-3 p-4">
        <div>
          <Link
            href={`/apprentissage/${course.slug}`}
            className="line-clamp-2 text-sm font-semibold text-foreground hover:underline"
          >
            {course.title}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            Par {instructorName}
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {isCompleted ? "Formation terminée" : "Progression"}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {percent} %
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all duration-300",
                isCompleted
                  ? "bg-[color:var(--brand-success)]"
                  : "bg-[color:var(--brand-secondary)]",
              )}
              style={{ width: `${Math.min(100, percent)}%` }}
              aria-hidden
            />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Inscrit le {dateFormatter.format(enrollment.enrolledAt)}
          {enrollment.completedAt
            ? ` · terminé le ${dateFormatter.format(enrollment.completedAt)}`
            : ""}
        </p>

        <Button asChild className="w-full" variant={isCompleted ? "outline" : "default"}>
          <Link href={href}>
            {!isCompleted ? <PlayCircle className="h-4 w-4" aria-hidden /> : null}
            {ctaLabel}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

interface WishlistCardProps {
  course: {
    id: string;
    slug: string;
    title: string;
    thumbnailUrl: string | null;
    instructor: {
      name: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  };
  addedAt: Date;
}

export function WishlistCard({ course, addedAt }: WishlistCardProps) {
  const instructorName =
    course.instructor.name ??
    ([course.instructor.firstName, course.instructor.lastName].filter(Boolean).join(" ") ||
      "Formateur");
  return (
    <Card className="overflow-hidden">
      <Link
        href={`/cours/${course.slug}`}
        className="relative block aspect-video overflow-hidden bg-muted"
      >
        {course.thumbnailUrl ? (
          <Image
            src={course.thumbnailUrl}
            alt={`Vignette de la formation ${course.title}`}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[color:var(--brand-primary)]/10 via-muted to-[color:var(--brand-accent)]/10 text-xs uppercase tracking-wide text-muted-foreground">
            Gandal
          </div>
        )}
      </Link>
      <CardContent className="space-y-3 p-4">
        <Badge variant="secondary" className="text-[10px]">
          ♥ Liste d&apos;envies
        </Badge>
        <Link
          href={`/cours/${course.slug}`}
          className="line-clamp-2 text-sm font-semibold text-foreground hover:underline"
        >
          {course.title}
        </Link>
        <p className="text-xs text-muted-foreground">Par {instructorName}</p>
        <p className="text-[11px] text-muted-foreground">
          Ajouté le {dateFormatter.format(addedAt)}
        </p>
        <Button asChild className="w-full" variant="default">
          <Link href={`/cours/${course.slug}`}>Voir la formation</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
