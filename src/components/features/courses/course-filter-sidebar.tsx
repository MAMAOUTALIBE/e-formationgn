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
// (checkboxes). Catégorie et Note restent mono-select (radios).
// Format URL : "?level=BEGINNER,INTERMEDIATE&duration=short,medium".

import { Check, ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
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
  const { pending, startTransition } = useFilterTransition();

  const currentCategory = params.get("category") ?? "";
  const currentLevels = parseCsv(params.get("level"));
  const currentDurations = parseCsv(params.get("duration"));
  const currentRating = params.get("rating") ?? "";

  const urlFilterKey = [
    currentCategory,
    currentLevels.join(","),
    currentDurations.join(","),
    currentRating,
  ].join("|");
  const [syncedUrlFilterKey, setSyncedUrlFilterKey] = React.useState(urlFilterKey);
  const [category, setCategory] = React.useState(currentCategory);
  const [levels, setLevels] = React.useState(currentLevels);
  const [durations, setDurations] = React.useState(currentDurations);
  const [rating, setRating] = React.useState(currentRating);

  // Resynchronise les choix lors d'une navigation externe (retour navigateur
  // ou lien filtré), sans effacer une sélection en cours de préparation.
  if (urlFilterKey !== syncedUrlFilterKey) {
    setSyncedUrlFilterKey(urlFilterKey);
    setCategory(currentCategory);
    setLevels(currentLevels);
    setDurations(currentDurations);
    setRating(currentRating);
  }

  function toggle(
    values: string[],
    setValues: React.Dispatch<React.SetStateAction<string[]>>,
    value: string,
  ) {
    setValues(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  }

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams(params.toString());
    const set = (key: string, value: string) => {
      if (value) next.set(key, value);
      else next.delete(key);
    };

    if (!hideCategory) set("category", category);
    set("level", levels.join(","));
    set("duration", durations.join(","));
    set("rating", rating);
    next.delete("page");

    startTransition(() => {
      router.push(`?${next.toString()}`, { scroll: false });
    });
  }

  function reset() {
    setCategory("");
    setLevels([]);
    setDurations([]);
    setRating("");
  }

  return (
    <aside
      aria-label="Filtres du catalogue"
      className={cn(
        "sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-[1.75rem] border border-sky-500/70 bg-[linear-gradient(145deg,#031735_0%,#04132d_58%,#021a26_100%)] p-4 text-sm text-slate-100 shadow-[0_0_22px_rgba(14,165,233,0.18),0_0_42px_rgba(34,197,94,0.08)]",
        className,
      )}
    >
      <div className="mb-4 flex items-center gap-3 px-1 pt-1">
        <h2 className="text-2xl font-bold tracking-tight text-white">Filtres</h2>
        <span className="rounded-xl border border-sky-400/25 bg-sky-400/10 p-2 shadow-[0_0_16px_rgba(34,211,238,0.14)]">
          <SlidersHorizontal className="h-5 w-5 text-emerald-400" aria-hidden />
        </span>
      </div>

      <form onSubmit={apply}>
        {!hideCategory && categories.length > 0 ? (
          <Section title="Catégorie" defaultOpen>
            <RadioRow
              name="sidebar-category"
              label="Toutes"
              checked={!category}
              onChange={() => setCategory("")}
            />
            {categories.map((c) => (
              <RadioRow
                key={c.slug}
                name="sidebar-category"
                label={c.name}
                count={countLabel(counts?.categories?.[c.slug])}
                checked={category === c.slug}
                onChange={() => setCategory(c.slug)}
              />
            ))}
          </Section>
        ) : null}

        <Section title="Note" defaultOpen>
          <RadioRow
            name="sidebar-rating"
            label="Toutes"
            checked={!rating}
            onChange={() => setRating("")}
          />
          {RATING_THRESHOLDS.map((threshold) => (
            <RadioRow
              key={threshold}
              name="sidebar-rating"
              label={
                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Stars
                    rating={threshold}
                    size="sm"
                    className="[&_svg]:stroke-slate-300"
                  />
                  <span>{threshold.toFixed(1)} et +</span>
                </span>
              }
              count={countLabel(counts?.ratings?.[String(threshold)])}
              checked={rating === String(threshold)}
              onChange={() => setRating(String(threshold))}
            />
          ))}
        </Section>

        <Section title="Niveau" defaultOpen>
          {COURSE_LEVELS.map((lv) => (
            <CheckRow
              key={lv}
              label={COURSE_LEVEL_LABELS[lv]}
              count={countLabel(counts?.levels?.[lv])}
              checked={levels.includes(lv)}
              onChange={() => toggle(levels, setLevels, lv)}
            />
          ))}
        </Section>

        <Section title="Durée" defaultOpen>
          {DURATION_FILTERS.filter((d) => d !== "all").map((d) => (
            <CheckRow
              key={d}
              label={DURATION_FILTER_LABELS[d]}
              count={countLabel(counts?.durations?.[d])}
              checked={durations.includes(d)}
              onChange={() => toggle(durations, setDurations, d)}
            />
          ))}
        </Section>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-500/80 bg-slate-950/25 px-3 font-semibold text-slate-100 transition hover:bg-sky-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-wait disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4 text-cyan-400" aria-hidden />
            Réinitialiser
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-400 px-3 font-bold text-slate-950 shadow-[0_0_18px_rgba(34,197,94,0.18)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#031735] disabled:cursor-wait disabled:opacity-60"
          >
            <Check className="h-4 w-4" aria-hidden />
            Appliquer
          </button>
        </div>
      </form>
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
    <section className="mb-3 rounded-2xl border border-slate-600/60 bg-slate-950/30 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] last:mb-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg text-left text-xs font-bold uppercase tracking-[0.08em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-emerald-400 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? <ul className="mt-3 space-y-1.5">{children}</ul> : null}
    </section>
  );
}

function RadioRow({
  name,
  label,
  count,
  checked,
  onChange,
}: {
  name: string;
  label: React.ReactNode;
  count?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <li>
      <label
        className={cn(
          "flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-sm leading-snug transition",
          checked
            ? "border-sky-500/80 bg-sky-500/10 text-white shadow-[0_0_14px_rgba(14,165,233,0.12)]"
            : "border-transparent text-slate-200 hover:border-slate-600/60 hover:bg-white/5",
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <input
            type="radio"
            name={name}
            checked={checked}
            onChange={onChange}
            className="h-4 w-4 shrink-0 accent-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
          <span className="min-w-0">{label}</span>
        </span>
        {count ? (
          <span className="shrink-0 text-xs tabular-nums text-slate-400">{count}</span>
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
          "flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-sm leading-snug transition",
          checked
            ? "border-sky-500/80 bg-sky-500/10 text-white shadow-[0_0_14px_rgba(14,165,233,0.12)]"
            : "border-transparent text-slate-200 hover:border-slate-600/60 hover:bg-white/5",
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            className="h-4 w-4 shrink-0 rounded accent-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
          <span className="min-w-0">{label}</span>
        </span>
        {count ? (
          <span className="shrink-0 text-xs tabular-nums text-slate-400">{count}</span>
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
