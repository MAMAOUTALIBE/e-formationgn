"use client";

// Sidebar verticale de filtres — pattern Udemy desktop. Visible uniquement
// en lg+ (lg:block, hidden par défaut). Sur mobile/tablette, on garde la
// top bar de chips + le drawer "Tous les filtres" + la bottom bar fixe.
//
// Pourquoi : sur grand écran, scanner verticalement une liste de filtres
// avec count est plus rapide qu'ouvrir 5 dropdowns. Et on garde le
// contexte de la page (résultats à côté).
//
// Multi-select : Niveau et Durée acceptent plusieurs valeurs simultanées
// (checkboxes). Catégorie, Prix et Note restent mono-select (radios).
// Format URL : "?level=BEGINNER,INTERMEDIATE&duration=short,medium".

import { ChevronDown, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { useFilterTransition } from "@/components/features/courses/filter-transition-context";
import { Stars } from "@/components/ui/stars";
import { cn } from "@/lib/utils";
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

interface CourseFilterSidebarProps {
  categories: CategoryOption[];
  counts?: {
    categories?: Record<string, number>;
    levels?: Record<string, number>;
    prices?: Record<string, number>;
    durations?: Record<string, number>;
    ratings?: Record<string, number>;
  };
  hideCategory?: boolean;
  className?: string;
}

function countLabel(count: number | undefined): string {
  if (typeof count !== "number") return "";
  return `(${count.toLocaleString("fr-FR")})`;
}

export function CourseFilterSidebar({
  categories,
  counts,
  hideCategory,
  className,
}: CourseFilterSidebarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const { startTransition } = useFilterTransition();

  const currentCategory = params.get("category") ?? "";
  const currentLevels = parseCsv(params.get("level"));
  const currentPrice = params.get("price") ?? "";
  const currentDurations = parseCsv(params.get("duration"));
  const currentRating = params.get("rating") ?? "";

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

  // Toggle d'une valeur dans une liste CSV — pattern multi-select.
  const toggle = React.useCallback(
    (key: "level" | "duration", value: string) => {
      const current = parseCsv(params.get(key));
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      update({ [key]: next.length > 0 ? next.join(",") : undefined });
    },
    [params, update],
  );

  function reset() {
    const term = params.get("q");
    const sort = params.get("sort");
    const next = new URLSearchParams();
    if (term) next.set("q", term);
    if (sort) next.set("sort", sort);
    startTransition(() => {
      router.push(`?${next.toString()}`, { scroll: false });
    });
  }

  const activeCount =
    (currentCategory && !hideCategory ? 1 : 0) +
    currentLevels.length +
    (currentPrice ? 1 : 0) +
    currentDurations.length +
    (currentRating ? 1 : 0);

  return (
    <aside
      aria-label="Filtres du catalogue"
      className={cn(
        "sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-border bg-card p-4 text-sm",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Filtres</h2>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" aria-hidden />
            Effacer ({activeCount})
          </button>
        ) : null}
      </div>

      {!hideCategory && categories.length > 0 ? (
        <Section title="Catégorie" defaultOpen>
          <RadioRow
            label="Toutes"
            checked={!currentCategory}
            onChange={() => update({ category: undefined })}
          />
          {categories.map((c) => (
            <RadioRow
              key={c.slug}
              label={c.name}
              count={countLabel(counts?.categories?.[c.slug])}
              checked={currentCategory === c.slug}
              onChange={() => update({ category: c.slug })}
            />
          ))}
        </Section>
      ) : null}

      <Section title="Note" defaultOpen>
        <RadioRow
          label="Toutes"
          checked={!currentRating}
          onChange={() => update({ rating: undefined })}
        />
        {RATING_THRESHOLDS.map((threshold) => (
          <RadioRow
            key={threshold}
            label={
              <span className="inline-flex items-center gap-2">
                <Stars rating={threshold} size="sm" />
                <span>{threshold.toFixed(1)} et +</span>
              </span>
            }
            count={countLabel(counts?.ratings?.[String(threshold)])}
            checked={currentRating === String(threshold)}
            onChange={() => update({ rating: String(threshold) })}
          />
        ))}
      </Section>

      <Section title="Niveau" defaultOpen>
        {COURSE_LEVELS.map((lv) => (
          <CheckRow
            key={lv}
            label={COURSE_LEVEL_LABELS[lv]}
            count={countLabel(counts?.levels?.[lv])}
            checked={currentLevels.includes(lv)}
            onChange={() => toggle("level", lv)}
          />
        ))}
      </Section>

      <Section title="Durée" defaultOpen>
        {DURATION_FILTERS.filter((d) => d !== "all").map((d) => (
          <CheckRow
            key={d}
            label={DURATION_FILTER_LABELS[d]}
            count={countLabel(counts?.durations?.[d])}
            checked={currentDurations.includes(d)}
            onChange={() => toggle("duration", d)}
          />
        ))}
      </Section>

      <Section title="Prix" defaultOpen>
        <RadioRow
          label="Tous"
          checked={!currentPrice}
          onChange={() => update({ price: undefined })}
        />
        <RadioRow
          label="Gratuit"
          count={countLabel(counts?.prices?.free)}
          checked={currentPrice === "free"}
          onChange={() => update({ price: "free" })}
        />
        <RadioRow
          label="Payant"
          count={countLabel(counts?.prices?.paid)}
          checked={currentPrice === "paid"}
          onChange={() => update({ price: "paid" })}
        />
      </Section>
    </aside>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-t border-border py-3 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wide text-foreground"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? <ul className="mt-2 space-y-1">{children}</ul> : null}
    </div>
  );
}

function RadioRow({
  label,
  count,
  checked,
  onChange,
}: {
  label: React.ReactNode;
  count?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <li>
      <label
        className={cn(
          "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          checked
            ? "bg-[color:var(--brand-secondary)]/10 text-foreground"
            : "text-foreground hover:bg-muted",
        )}
      >
        <span className="flex items-center gap-2">
          <input
            type="radio"
            checked={checked}
            onChange={onChange}
            className="h-3.5 w-3.5 accent-[color:var(--brand-secondary)]"
          />
          {label}
        </span>
        {count ? (
          <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
        ) : null}
      </label>
    </li>
  );
}

function CheckRow({
  label,
  count,
  checked,
  onChange,
}: {
  label: React.ReactNode;
  count?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <li>
      <label
        className={cn(
          "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          checked
            ? "bg-[color:var(--brand-secondary)]/10 text-foreground"
            : "text-foreground hover:bg-muted",
        )}
      >
        <span className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            className="h-4 w-4 rounded accent-[color:var(--brand-secondary)]"
          />
          {label}
        </span>
        {count ? (
          <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
        ) : null}
      </label>
    </li>
  );
}

// Parse une string CSV de l'URL en array de valeurs trimées.
function parseCsv(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
}
