"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useFilterTransition } from "@/components/features/courses/filter-transition-context";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Stars } from "@/components/ui/stars";
import {
  COURSE_LEVEL_LABELS,
  DURATION_FILTER_LABELS,
} from "@/lib/format/labels";
import {
  COURSE_LEVELS,
  DURATION_FILTERS,
} from "@/lib/validators/courses";

const RATING_THRESHOLDS = [4.5, 4, 3.5, 3] as const;

interface CategoryOption {
  slug: string;
  name: string;
}

interface CourseFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  categories: CategoryOption[];
  counts?: {
    categories?: Record<string, number>;
    levels?: Record<string, number>;
    durations?: Record<string, number>;
    ratings?: Record<string, number>;
  };
  hideCategory?: boolean;
}

function countSuffix(count: number | undefined): string {
  if (typeof count !== "number") return "";
  return ` (${count.toLocaleString("fr-FR")})`;
}

export function CourseFilterDrawer({
  open,
  onClose,
  categories,
  counts,
  hideCategory,
}: CourseFilterDrawerProps) {
  const router = useRouter();
  const params = useSearchParams();
  const { pending, startTransition } = useFilterTransition();

  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");
  const [duration, setDuration] = useState("");
  const [rating, setRating] = useState("");

  // Resynchronise les champs sur les paramètres d'URL à chaque ouverture du
  // tiroir. Pattern React « ajuster l'état quand une prop change » : on
  // détecte la transition fermé→ouvert pendant le render (pas dans un effet,
  // donc pas de cascade de renders). https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCategory(params.get("category") ?? "");
      setLevel(params.get("level") ?? "");
      setDuration(params.get("duration") ?? "");
      setRating(params.get("rating") ?? "");
    }
  }

  function apply() {
    const next = new URLSearchParams(params.toString());
    const set = (key: string, value: string) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    };
    if (!hideCategory) set("category", category);
    set("level", level);
    set("duration", duration);
    set("rating", rating);
    next.delete("page");
    startTransition(() => {
      router.push(`?${next.toString()}`, { scroll: false });
      onClose();
    });
  }

  function reset() {
    setCategory("");
    setLevel("");
    setDuration("");
    setRating("");
  }

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title="Tous les filtres"
      description="Affinez votre sélection pour trouver la formation idéale."
      size="md"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={reset} disabled={pending}>
            Réinitialiser
          </Button>
          <Button type="button" onClick={apply} disabled={pending}>
            Appliquer
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {!hideCategory && categories.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="drawer-category">Catégorie</Label>
            <Select
              id="drawer-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Toutes les catégories</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                  {countSuffix(counts?.categories?.[c.slug])}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="drawer-level">Niveau</Label>
          <Select
            id="drawer-level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="">Tous les niveaux</option>
            {COURSE_LEVELS.map((lv) => (
              <option key={lv} value={lv}>
                {COURSE_LEVEL_LABELS[lv]}
                {countSuffix(counts?.levels?.[lv])}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="drawer-duration">Durée</Label>
          <Select
            id="drawer-duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            {DURATION_FILTERS.map((d) => (
              <option key={d} value={d === "all" ? "" : d}>
                {DURATION_FILTER_LABELS[d]}
                {d !== "all" ? countSuffix(counts?.durations?.[d]) : ""}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Note minimale</p>
          <ul className="space-y-1.5">
            {RATING_THRESHOLDS.map((threshold) => {
              const isSelected = rating === String(threshold);
              return (
                <li key={threshold}>
                  <button
                    type="button"
                    onClick={() => setRating(isSelected ? "" : String(threshold))}
                    aria-pressed={isSelected}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                      isSelected
                        ? "bg-[color:var(--brand-primary)]/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Stars rating={threshold} size="sm" />
                      <span>
                        {threshold.toFixed(1)} et plus
                        {countSuffix(counts?.ratings?.[String(threshold)])}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </DetailDrawer>
  );
}
