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
      <div className="rounded-lg border border-dashed border-border bg-muted/40 p-10 text-center text-sm text-muted-foreground">
        {emptyMessage ?? "Aucun cours ne correspond à votre recherche pour le moment."}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} currency={currency} />
      ))}
    </div>
  );
}
