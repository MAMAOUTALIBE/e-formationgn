"use client";

// Segment 7J / 30J / 90J du tableau de bord.
//
// Complète <DateRangePicker> plutôt que de le remplacer : les trois fenêtres
// utilisées tous les jours passent à un clic, et le sélecteur complet reste
// disponible à côté pour « aujourd'hui », « 12 mois » et les dates
// personnalisées.

import { useRouter, useSearchParams } from "next/navigation";

import {
  parsePeriodParam,
  persistPeriodCookie,
  type PeriodPreset,
} from "@/lib/admin/period";
import { cn } from "@/lib/utils";

const SEGMENTS: Array<{ preset: PeriodPreset; label: string; title: string }> = [
  { preset: "7d", label: "7J", title: "7 derniers jours" },
  { preset: "30d", label: "30J", title: "30 derniers jours" },
  { preset: "90d", label: "90J", title: "90 derniers jours" },
];

export function PeriodSegments({ paramName = "period" }: { paramName?: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const current = parsePeriodParam(search.get(paramName)).preset;

  function apply(preset: PeriodPreset) {
    const params = new URLSearchParams(search.toString());
    params.set(paramName, preset);
    // Même cookie que <DateRangePicker> : la période choisie ici est celle que
    // les autres écrans du CRM retrouveront.
    persistPeriodCookie(preset);
    router.push(`?${params.toString()}`);
  }

  return (
    <div
      role="group"
      aria-label="Période"
      className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1"
    >
      {SEGMENTS.map((segment) => {
        const active = current === segment.preset;
        return (
          <button
            key={segment.preset}
            type="button"
            onClick={() => apply(segment.preset)}
            aria-pressed={active}
            title={segment.title}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
              active
                ? "bg-[color:var(--brand-primary)] text-white shadow-sm"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            )}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
