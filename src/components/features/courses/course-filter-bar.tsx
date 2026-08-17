"use client";

import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { Stars } from "@/components/ui/stars";
import { cn } from "@/lib/utils";
import {
  COURSE_LEVEL_LABELS,
  DURATION_FILTER_LABELS,
  SORT_LABELS,
} from "@/lib/format/labels";
import {
  COURSE_LEVELS,
  DURATION_FILTERS,
  SORT_OPTIONS,
} from "@/lib/validators/courses";

import { useFilterTransition } from "./filter-transition-context";
import { CourseFilterDrawer } from "./course-filter-drawer";

const RATING_THRESHOLDS = [4.5, 4, 3.5, 3] as const;

interface CategoryOption {
  slug: string;
  name: string;
}

export interface CourseFilterCountsProp {
  categories?: Record<string, number>;
  levels?: Record<string, number>;
  durations?: Record<string, number>;
  ratings?: Record<string, number>;
}

interface CourseFilterBarProps {
  categories: CategoryOption[];
  counts?: CourseFilterCountsProp;
  hideCategory?: boolean;
  className?: string;
}

// Helper : suffixe " (12)" si on a un count, "" sinon. Format français.
function countSuffix(count: number | undefined): string {
  if (typeof count !== "number") return "";
  return ` (${count.toLocaleString("fr-FR")})`;
}

export function CourseFilterBar({
  categories,
  counts,
  hideCategory,
  className,
}: CourseFilterBarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const { startTransition } = useFilterTransition();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const currentCategory = params.get("category") ?? "";
  const currentLevelRaw = params.get("level") ?? "";
  const currentLevels = currentLevelRaw ? currentLevelRaw.split(",").filter(Boolean) : [];
  const currentLevel = currentLevels[0] ?? ""; // pour radio mono dans les dropdowns chip
  const currentDurationRaw = params.get("duration") ?? "";
  const currentDurations = currentDurationRaw ? currentDurationRaw.split(",").filter(Boolean) : [];
  const currentDuration = currentDurations[0] ?? "";
  const currentRating = params.get("rating") ?? "";
  const currentSort = params.get("sort") ?? "relevance";

  const update = React.useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (!value) next.delete(key);
        else next.set(key, value);
      }
      next.delete("page");
      startTransition(() => {
        router.push(`?${next.toString()}`, { scroll: false });
      });
    },
    [params, router, startTransition],
  );

  function reset() {
    const term = params.get("q");
    const next = new URLSearchParams();
    if (term) next.set("q", term);
    startTransition(() => {
      router.push(`?${next.toString()}`, { scroll: false });
    });
  }

  const activeCount =
    (currentCategory ? 1 : 0) +
    currentLevels.length +
    currentDurations.length +
    (currentRating ? 1 : 0);

  const categoryName =
    categories.find((c) => c.slug === currentCategory)?.name ?? "";

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          className,
        )}
        role="toolbar"
        aria-label="Filtres du catalogue"
      >
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-foreground/30 bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Tous les filtres
          {activeCount > 0 ? (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[color:var(--brand-secondary)] px-1.5 text-[10px] font-semibold text-white">
              {activeCount}
            </span>
          ) : null}
        </button>

        {!hideCategory && categories.length > 0 ? (
          <FilterChip
            label="Catégorie"
            value={currentCategory}
            valueLabel={categoryName}
            onClear={() => update({ category: undefined })}
          >
            {(close) => (
              <FilterMenu>
                <FilterOption
                  selected={!currentCategory}
                  onClick={() => {
                    update({ category: undefined });
                    close();
                  }}
                >
                  Toutes les catégories
                </FilterOption>
                {categories.map((c) => (
                  <FilterOption
                    key={c.slug}
                    selected={currentCategory === c.slug}
                    onClick={() => {
                      update({ category: c.slug });
                      close();
                    }}
                  >
                    {c.name}
                    {countSuffix(counts?.categories?.[c.slug])}
                  </FilterOption>
                ))}
              </FilterMenu>
            )}
          </FilterChip>
        ) : null}

        <FilterChip
          label="Niveau"
          value={currentLevelRaw}
          valueLabel={
            currentLevels.length === 1
              ? COURSE_LEVEL_LABELS[currentLevels[0] as keyof typeof COURSE_LEVEL_LABELS]
              : currentLevels.length > 1
                ? `${currentLevels.length} sélectionnés`
                : ""
          }
          onClear={() => update({ level: undefined })}
        >
          {(close) => (
            <FilterMenu>
              <FilterOption
                selected={!currentLevel}
                onClick={() => {
                  update({ level: undefined });
                  close();
                }}
              >
                Tous les niveaux
              </FilterOption>
              {COURSE_LEVELS.map((lv) => (
                <FilterOption
                  key={lv}
                  selected={currentLevel === lv}
                  onClick={() => {
                    update({ level: lv });
                    close();
                  }}
                >
                  {COURSE_LEVEL_LABELS[lv]}
                  {countSuffix(counts?.levels?.[lv])}
                </FilterOption>
              ))}
            </FilterMenu>
          )}
        </FilterChip>

        <FilterChip
          label="Durée"
          value={currentDurationRaw}
          valueLabel={
            currentDurations.length === 1
              ? DURATION_FILTER_LABELS[currentDurations[0] as keyof typeof DURATION_FILTER_LABELS]
              : currentDurations.length > 1
                ? `${currentDurations.length} sélectionnées`
                : ""
          }
          onClear={() => update({ duration: undefined })}
        >
          {(close) => (
            <FilterMenu>
              {DURATION_FILTERS.map((d) => (
                <FilterOption
                  key={d}
                  selected={d === "all" ? !currentDuration : currentDuration === d}
                  onClick={() => {
                    update({ duration: d === "all" ? undefined : d });
                    close();
                  }}
                >
                  {DURATION_FILTER_LABELS[d]}
                  {d !== "all" ? countSuffix(counts?.durations?.[d]) : ""}
                </FilterOption>
              ))}
            </FilterMenu>
          )}
        </FilterChip>

        <FilterChip
          label="Note"
          value={currentRating}
          valueLabel={currentRating ? `${Number(currentRating).toFixed(1)}+ ★` : ""}
          onClear={() => update({ rating: undefined })}
        >
          {(close) => (
            <FilterMenu>
              <FilterOption
                selected={!currentRating}
                onClick={() => {
                  update({ rating: undefined });
                  close();
                }}
              >
                Toutes les notes
              </FilterOption>
              {RATING_THRESHOLDS.map((threshold) => (
                <FilterOption
                  key={threshold}
                  selected={currentRating === String(threshold)}
                  onClick={() => {
                    update({ rating: String(threshold) });
                    close();
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Stars rating={threshold} size="sm" />
                    <span>
                      {threshold.toFixed(1)} et plus
                      {countSuffix(counts?.ratings?.[String(threshold)])}
                    </span>
                  </span>
                </FilterOption>
              ))}
            </FilterMenu>
          )}
        </FilterChip>

        {activeCount > 0 ? (
          <button
            type="button"
            onClick={reset}
            className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Effacer
          </button>
        ) : null}

        <div className="ml-auto">
          <FilterChip
            label="Trier par"
            value={currentSort === "relevance" ? "" : currentSort}
            valueLabel={SORT_LABELS[currentSort]}
            align="right"
          >
            {(close) => (
              <FilterMenu>
                {SORT_OPTIONS.map((option) => (
                  <FilterOption
                    key={option}
                    selected={currentSort === option}
                    onClick={() => {
                      update({ sort: option === "relevance" ? undefined : option });
                      close();
                    }}
                  >
                    {SORT_LABELS[option]}
                  </FilterOption>
                ))}
              </FilterMenu>
            )}
          </FilterChip>
        </div>
      </div>

      <CourseFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        categories={categories}
        counts={counts}
        hideCategory={hideCategory}
      />
    </>
  );
}

interface FilterChipProps {
  label: string;
  value: string;
  valueLabel?: string;
  onClear?: () => void;
  align?: "left" | "right";
  children: (close: () => void) => React.ReactNode;
}

function FilterChip({
  label,
  value,
  valueLabel,
  onClear,
  align = "left",
  children,
}: FilterChipProps) {
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  const hasValue = Boolean(value);

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={cn(
          "inline-flex items-center rounded-full border text-sm transition-colors",
          hasValue
            ? "border-[color:var(--brand-secondary)] bg-[color:var(--brand-secondary)]/10 text-foreground"
            : "border-foreground/30 bg-card text-foreground hover:bg-muted",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 font-medium"
        >
          <span>
            {label}
            {hasValue && valueLabel ? (
              <span className="text-foreground">{` : ${valueLabel}`}</span>
            ) : null}
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
        {hasValue && onClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Effacer ${label.toLowerCase()}`}
            className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          className={cn(
            "absolute top-[calc(100%+0.5rem)] z-30 min-w-[14rem] max-w-[18rem]",
            align === "right" ? "right-0" : "left-0",
          )}
          role="menu"
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

function FilterMenu({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-1.5 shadow-lg">
      <ul className="max-h-72 space-y-0.5 overflow-y-auto">{children}</ul>
    </div>
  );
}

function FilterOption({
  children,
  selected,
  onClick,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        role="menuitemradio"
        aria-checked={selected}
        className={cn(
          "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
          selected
            ? "bg-[color:var(--brand-secondary)]/10 font-medium text-foreground"
            : "text-foreground hover:bg-muted",
        )}
      >
        <span>{children}</span>
        {selected ? <span aria-hidden className="text-[color:var(--brand-secondary)]">✓</span> : null}
      </button>
    </li>
  );
}
