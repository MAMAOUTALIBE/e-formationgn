"use client";

// Toggle de langue FR / EN. Server Action côté serveur, refresh automatique
// via revalidatePath du layout — toutes les pages serveur récupèrent la
// nouvelle locale au prochain render.

import { Globe } from "lucide-react";
import { useTransition } from "react";

import {
  LOCALE_SHORT,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { setLocale } from "@/server/actions/locale";

interface LocaleToggleProps {
  current: Locale;
  className?: string;
  /** "compact" : juste FR/EN. "full" : icône globe + label complet. */
  variant?: "compact" | "full";
}

export function LocaleToggle({
  current,
  className,
  variant = "compact",
}: LocaleToggleProps) {
  const [pending, startTransition] = useTransition();

  function handleChange(next: Locale) {
    if (next === current || pending) return;
    startTransition(async () => {
      await setLocale(next);
    });
  }

  return (
    <div
      role="group"
      aria-label="Langue"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5 text-xs",
        className,
      )}
    >
      {variant === "full" ? (
        <Globe
          className="ml-1 h-3.5 w-3.5 text-muted-foreground"
          aria-hidden
        />
      ) : null}
      {SUPPORTED_LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            disabled={pending || active}
            onClick={() => handleChange(locale)}
            aria-pressed={active}
            className={cn(
              "rounded px-2 py-1 font-medium transition-colors",
              active
                ? "bg-[color:var(--brand-primary)] text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {LOCALE_SHORT[locale]}
          </button>
        );
      })}
    </div>
  );
}
