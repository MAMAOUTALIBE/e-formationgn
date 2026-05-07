"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Stars } from "@/components/ui/stars";
import {
  COURSE_LEVEL_LABELS,
  DURATION_FILTER_LABELS,
  PRICE_FILTER_LABELS,
} from "@/lib/format/labels";
import {
  COURSE_LEVELS,
  DURATION_FILTERS,
  PRICE_FILTERS,
} from "@/lib/validators/courses";

const RATING_THRESHOLDS = [4.5, 4, 3.5, 3] as const;

interface CategoryOption {
  slug: string;
  name: string;
}

interface CourseFiltersProps {
  categories: CategoryOption[];
  /** Si true, on cache le filtre catégorie (déjà imposé par l'URL) */
  hideCategory?: boolean;
}

export function CourseFilters({ categories, hideCategory }: CourseFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");
    startTransition(() => {
      router.push(`?${next.toString()}`, { scroll: false });
    });
  }

  function reset() {
    const term = params.get("q");
    const next = new URLSearchParams();
    if (term) next.set("q", term);
    startTransition(() => {
      router.push(`?${next.toString()}`, { scroll: false });
    });
  }

  const currentLevel = params.get("level") ?? "";
  const currentPrice = params.get("price") ?? "";
  const currentDuration = params.get("duration") ?? "";
  const currentRating = params.get("rating") ?? "";
  const currentCategory = params.get("category") ?? "";

  const isActive =
    Boolean(currentLevel) ||
    Boolean(currentPrice) ||
    Boolean(currentDuration) ||
    Boolean(currentRating) ||
    Boolean(currentCategory);

  return (
    <aside
      className="rounded-lg border border-border bg-card p-5"
      aria-label="Filtres du catalogue"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Filtres</h2>
        {isActive ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={reset}
            disabled={pending}
            className="h-auto px-0 text-xs"
          >
            Tout effacer
          </Button>
        ) : null}
      </div>

      <div className="space-y-5">
        {!hideCategory && categories.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="filter-category">Catégorie</Label>
            <Select
              id="filter-category"
              value={currentCategory}
              onChange={(event) => update({ category: event.target.value || undefined })}
              disabled={pending}
            >
              <option value="">Toutes les catégories</option>
              {categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="filter-level">Niveau</Label>
          <Select
            id="filter-level"
            value={currentLevel}
            onChange={(event) => update({ level: event.target.value || undefined })}
            disabled={pending}
          >
            <option value="">Tous les niveaux</option>
            {COURSE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {COURSE_LEVEL_LABELS[level]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-price">Prix</Label>
          <Select
            id="filter-price"
            value={currentPrice}
            onChange={(event) => update({ price: event.target.value || undefined })}
            disabled={pending}
          >
            {PRICE_FILTERS.map((price) => (
              <option key={price} value={price === "all" ? "" : price}>
                {PRICE_FILTER_LABELS[price]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-duration">Durée</Label>
          <Select
            id="filter-duration"
            value={currentDuration}
            onChange={(event) => update({ duration: event.target.value || undefined })}
            disabled={pending}
          >
            {DURATION_FILTERS.map((duration) => (
              <option key={duration} value={duration === "all" ? "" : duration}>
                {DURATION_FILTER_LABELS[duration]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Note minimale</p>
          <ul className="space-y-1.5">
            {RATING_THRESHOLDS.map((threshold) => {
              const isSelected = currentRating === String(threshold);
              return (
                <li key={threshold}>
                  <button
                    type="button"
                    onClick={() =>
                      update({ rating: isSelected ? undefined : String(threshold) })
                    }
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-xs transition-colors ${
                      isSelected
                        ? "bg-[color:var(--brand-primary)]/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    disabled={pending}
                    aria-pressed={isSelected}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Stars rating={threshold} size="sm" />
                      <span>{threshold.toFixed(1)} et plus</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </aside>
  );
}
