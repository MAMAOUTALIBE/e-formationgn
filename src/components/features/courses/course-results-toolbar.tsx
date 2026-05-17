"use client";

// Toolbar minimaliste au-dessus de la grille de résultats — pattern Udemy
// "1,234 résultats — Trier par ▾ Plus pertinent". Toujours visible, contient :
//   - le count de résultats
//   - le dropdown de tri (dropdown <select> natif pour simplicité + mobile)

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { useFilterTransition } from "@/components/features/courses/filter-transition-context";
import { Select } from "@/components/ui/select";
import { SORT_LABELS } from "@/lib/format/labels";
import { SORT_OPTIONS, type CourseSort } from "@/lib/validators/courses";

interface CourseResultsToolbarProps {
  total: number;
  searchTerm?: string;
  /** Slot optionnel à droite (ex: toggle vue grille/liste). */
  rightSlot?: React.ReactNode;
}

export function CourseResultsToolbar({
  total,
  searchTerm,
  rightSlot,
}: CourseResultsToolbarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const { startTransition } = useFilterTransition();
  const currentSort = (params.get("sort") ?? "relevance") as CourseSort;

  function onSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value as CourseSort;
    const next = new URLSearchParams(params.toString());
    if (value === "relevance") next.delete("sort");
    else next.set("sort", value);
    next.delete("page");
    startTransition(() => {
      router.push(`?${next.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <p className="text-sm text-foreground">
        <span className="font-semibold tabular-nums">
          {total.toLocaleString("fr-FR")}
        </span>{" "}
        <span className="text-muted-foreground">
          {total > 1 ? "résultats" : "résultat"}
          {searchTerm ? ` pour « ${searchTerm} »` : ""}
        </span>
      </p>
      <div className="flex items-center gap-2">
        <label
          htmlFor="results-sort"
          className="hidden text-xs font-medium text-muted-foreground sm:inline"
        >
          Trier par
        </label>
        <Select
          id="results-sort"
          value={currentSort}
          onChange={onSortChange}
          className="h-9 w-auto"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {SORT_LABELS[opt]}
            </option>
          ))}
        </Select>
        {rightSlot}
      </div>
    </div>
  );
}
