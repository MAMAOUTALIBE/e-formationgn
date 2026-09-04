"use client";

import { ArrowDownUp, SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { DetailDrawer } from "@/components/ui/detail-drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SORT_LABELS } from "@/lib/format/labels";
import { SORT_OPTIONS } from "@/lib/validators/courses";

import { CourseFilterDrawer } from "./course-filter-drawer";
import { useFilterTransition } from "./filter-transition-context";

interface CategoryOption {
  slug: string;
  name: string;
}

interface CourseMobileFilterBarProps {
  categories: CategoryOption[];
  counts?: {
    categories?: Record<string, number>;
    levels?: Record<string, number>;
    prices?: Record<string, number>;
    durations?: Record<string, number>;
    ratings?: Record<string, number>;
  };
  hideCategory?: boolean;
  categoryOnly?: boolean;
}

export function CourseMobileFilterBar({
  categories,
  counts,
  hideCategory,
  categoryOnly = false,
}: CourseMobileFilterBarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const { startTransition } = useFilterTransition();
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [sortOpen, setSortOpen] = React.useState(false);

  const currentSort = params.get("sort") ?? "relevance";

  const activeCount = categoryOnly
    ? params.get("category")
      ? 1
      : 0
    : (params.get("category") ? 1 : 0) +
      (params.get("level") ? 1 : 0) +
      (params.get("price") ? 1 : 0) +
      (params.get("duration") ? 1 : 0) +
      (params.get("rating") ? 1 : 0);

  function setSort(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "relevance") next.delete("sort");
    else next.set("sort", value);
    next.delete("page");
    startTransition(() => {
      router.push(`?${next.toString()}`, { scroll: false });
      setSortOpen(false);
    });
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-px border-t border-border bg-card shadow-[0_-4px_12px_rgba(0,0,0,0.06)] sm:hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-foreground hover:bg-muted"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {categoryOnly ? "Catégorie" : "Filtres"}
          {activeCount > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--brand-secondary)] px-1.5 text-[10px] font-semibold text-white">
              {activeCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => setSortOpen(true)}
          className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-foreground hover:bg-muted"
        >
          <ArrowDownUp className="h-4 w-4" />
          Trier
        </button>
      </div>

      <div aria-hidden className="h-14 sm:hidden" />

      <CourseFilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        categories={categories}
        counts={counts}
        hideCategory={hideCategory}
        categoryOnly={categoryOnly}
      />

      <DetailDrawer
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        title="Trier par"
        size="md"
      >
        <ul className="space-y-1">
          {SORT_OPTIONS.map((option) => (
            <li key={option}>
              <Button
                type="button"
                variant={currentSort === option ? "secondary" : "ghost"}
                onClick={() => setSort(option)}
                className={cn("w-full justify-between")}
              >
                <span>{SORT_LABELS[option]}</span>
                {currentSort === option ? (
                  <span aria-hidden className="text-[color:var(--brand-secondary)]">✓</span>
                ) : null}
              </Button>
            </li>
          ))}
        </ul>
      </DetailDrawer>
    </>
  );
}
