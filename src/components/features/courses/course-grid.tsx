import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Currency } from "@/generated/prisma/enums";
import type { PublicCourseListItem } from "@/server/queries/courses";

import { CourseCard } from "./course-card";

interface CourseGridProps {
  courses: PublicCourseListItem[];
  currency?: Currency;
  className?: string;
  emptyMessage?: string;
}

export function CourseGrid({ courses, currency, className, emptyMessage }: CourseGridProps) {
  if (courses.length === 0) {
    return (
      <EmptyState
        title={emptyMessage ?? "Aucun cours ne correspond à votre recherche pour le moment."}
      />
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {courses.map((course, idx) => (
        <CourseCard
          key={course.id}
          course={course}
          currency={currency}
          // Le flyout s'ouvre à droite par défaut. Pour les cartes de la
          // dernière colonne d'un grid lg:grid-cols-3 (index 2, 5, 8...),
          // on l'ouvre à gauche pour éviter le débordement viewport.
          flyoutSide={idx % 3 === 2 ? "left" : "right"}
        />
      ))}
    </div>
  );
}
