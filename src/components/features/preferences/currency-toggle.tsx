"use client";

import { useTransition } from "react";

import { setCurrency } from "@/server/actions/cart";
import { cn } from "@/lib/utils";
import type { Currency } from "@/generated/prisma/enums";

interface CurrencyToggleProps {
  current: Currency;
  className?: string;
}

const OPTIONS: Currency[] = ["EUR", "USD"];

export function CurrencyToggle({ current, className }: CurrencyToggleProps) {
  const [pending, startTransition] = useTransition();

  function handleSelect(value: Currency) {
    if (value === current || pending) return;
    const data = new FormData();
    data.set("currency", value);
    startTransition(async () => {
      await setCurrency(data);
    });
  }

  return (
    <div
      role="group"
      aria-label="Devise"
      className={cn(
        "inline-flex overflow-hidden rounded-md border border-border bg-card text-xs",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const active = option === current;
        return (
          <button
            key={option}
            type="button"
            onClick={() => handleSelect(option)}
            aria-pressed={active}
            disabled={pending}
            className={cn(
              "px-2.5 py-1 font-medium transition-colors",
              active
                ? "bg-[color:var(--brand-primary)] text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
