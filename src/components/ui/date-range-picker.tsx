"use client";

import { Calendar } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  PERIOD_COOKIE_NAME,
  parsePeriodParam,
  PRESET_LABELS,
  type PeriodPreset,
  type PeriodValue,
} from "@/lib/admin/period";
import { cn } from "@/lib/utils";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function persistPeriodCookie(serialized: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${PERIOD_COOKIE_NAME}=${encodeURIComponent(serialized)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function DateRangePicker({ paramName = "period" }: { paramName?: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const initial = parsePeriodParam(search.get(paramName));
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodValue>(initial);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function applyPreset(preset: PeriodPreset) {
    const next: PeriodValue = { preset };
    setPeriod(next);
    pushUrl(next);
    if (preset !== "custom") setOpen(false);
  }

  function applyCustom() {
    if (!period.from || !period.to) return;
    pushUrl(period);
    setOpen(false);
  }

  function pushUrl(p: PeriodValue) {
    const params = new URLSearchParams(search.toString());
    const value =
      p.preset === "custom" && p.from && p.to
        ? `custom|${p.from}|${p.to}`
        : p.preset;
    params.set(paramName, value);
    persistPeriodCookie(value);
    router.push(`?${params.toString()}`);
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="gap-2"
      >
        <Calendar className="h-4 w-4" aria-hidden />
        {PRESET_LABELS[period.preset]}
        {period.preset === "custom" && period.from && period.to
          ? ` · ${period.from} → ${period.to}`
          : ""}
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(calc(100vw-2rem),18rem)] rounded-md border border-border bg-popover p-2 shadow-lg">
          <div className="grid gap-1">
            {(Object.keys(PRESET_LABELS) as PeriodPreset[])
              .filter((p) => p !== "custom")
              .map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-left text-sm hover:bg-muted",
                    period.preset === p && "bg-muted font-medium",
                  )}
                >
                  {PRESET_LABELS[p]}
                </button>
              ))}
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Personnalisé
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="date"
                value={period.from ?? ""}
                onChange={(e) =>
                  setPeriod({ preset: "custom", from: e.target.value, to: period.to })
                }
                className="rounded-md border border-border bg-background px-2 py-2 text-base sm:py-1 sm:text-sm"
              />
              <input
                type="date"
                value={period.to ?? ""}
                onChange={(e) =>
                  setPeriod({ preset: "custom", from: period.from, to: e.target.value })
                }
                className="rounded-md border border-border bg-background px-2 py-2 text-base sm:py-1 sm:text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={applyCustom}
              disabled={!period.from || !period.to}
              className="mt-2 w-full"
            >
              Appliquer
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
