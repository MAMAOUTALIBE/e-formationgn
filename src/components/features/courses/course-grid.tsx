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
        // Grille façon Udemy : cartes compactes, gap resserré. 3 colonnes
        // (cartes assez larges pour la rangée de pastilles sur une ligne).
        "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {courses.map((course, idx) => (
        <CourseCard
          key={course.id}
          course={course}
          currency={currency}
          // Flyout à gauche pour la dernière colonne (index 2, 5…) afin d'éviter
          // le débordement du viewport.
          flyoutSide={idx % 3 === 2 ? "left" : "right"}
        />
      ))}
    </div>
  );
}
