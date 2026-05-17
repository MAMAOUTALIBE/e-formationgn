"use client";

// Conteneur client pour la zone résultats du catalogue : toolbar (count + tri
// + toggle vue) + grille ou liste de cartes selon la préférence utilisateur.
//
// La préférence vue (grid|list) est persistée en localStorage. Au premier
// render serveur on affiche "grid" par défaut (évite l'hydration mismatch),
// puis on bascule vers la valeur stockée au mount client.

import { LayoutGrid, List } from "lucide-react";
import * as React from "react";

import { CourseCard } from "@/components/features/courses/course-card";
import { CourseCardList } from "@/components/features/courses/course-card-list";
import { CourseResultsToolbar } from "@/components/features/courses/course-results-toolbar";
import { useFilterTransition } from "@/components/features/courses/filter-transition-context";
import { cn } from "@/lib/utils";
import type { Currency } from "@/generated/prisma/enums";
import type { PublicCourseListItem } from "@/server/queries/courses";

const STORAGE_KEY = "gandal:view-mode";

type ViewMode = "grid" | "list";

interface CourseResultsAreaProps {
  courses: PublicCourseListItem[];
  currency?: Currency;
  total: number;
  searchTerm?: string;
}

export function CourseResultsArea({
  courses,
  currency,
  total,
  searchTerm,
}: CourseResultsAreaProps) {
  const [mode, setMode] = React.useState<ViewMode>("grid");
  const { pending } = useFilterTransition();

  // Hydratation client : lit la préférence stockée. Évite l'hydration mismatch
  // en partant toujours de "grid" côté SSR.
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "list" || saved === "grid") setMode(saved);
    } catch {
      /* localStorage indisponible — ignore */
    }
  }, []);

  function changeMode(next: ViewMode) {
    setMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-4">
      <CourseResultsToolbar
        total={total}
        searchTerm={searchTerm}
        rightSlot={<ViewModeToggle mode={mode} onChange={changeMode} />}
      />

      {courses.length === 0 ? null : (
        // Pendant le changement de filtre, dim la grille + désactive les
        // interactions. Le router re-rend avec les nouveaux résultats dès
        // que la query est terminée → effet "snap to result" perçu rapide.
        <div
          data-pending={pending ? "true" : "false"}
          className={cn(
            "transition-opacity duration-150",
            pending && "pointer-events-none opacity-50",
          )}
          aria-busy={pending}
        >
          {mode === "grid" ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course, idx) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  currency={currency}
                  flyoutSide={idx % 3 === 2 ? "left" : "right"}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {courses.map((course) => (
                <CourseCardList key={course.id} course={course} currency={currency} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Vue des résultats"
      className="hidden items-center rounded-md border border-border bg-card p-0.5 sm:inline-flex"
    >
      <ToggleBtn
        active={mode === "grid"}
        onClick={() => onChange("grid")}
        label="Vue grille"
      >
        <LayoutGrid className="h-4 w-4" aria-hidden />
      </ToggleBtn>
      <ToggleBtn
        active={mode === "list"}
        onClick={() => onChange("list")}
        label="Vue liste"
      >
        <List className="h-4 w-4" aria-hidden />
      </ToggleBtn>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="radio"
      aria-checked={active}
      aria-label={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded transition-colors",
        active
          ? "bg-[color:var(--brand-secondary)] text-white"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
