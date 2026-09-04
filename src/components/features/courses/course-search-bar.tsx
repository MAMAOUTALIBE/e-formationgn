"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CourseSearchBarProps {
  className?: string;
  placeholder?: string;
  /** Si true, on submit vers /cours (recherche globale depuis la home) */
  redirectToCatalog?: boolean;
  /** Présentation compacte du champ et du bouton dans une capsule unique. */
  integrated?: boolean;
}

export function CourseSearchBar({
  className,
  placeholder = "Rechercher une formation, un sujet, un formateur…",
  redirectToCatalog = false,
  integrated = false,
}: CourseSearchBarProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = value.trim();
    const next = new URLSearchParams(params.toString());
    if (term) next.set("q", term);
    else next.delete("q");
    next.delete("page");
    const target = redirectToCatalog ? "/cours" : window.location.pathname;
    startTransition(() => {
      router.push(`${target}?${next.toString()}`);
    });
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={cn(
        "flex w-full items-center",
        integrated
          ? "max-w-3xl gap-0 rounded-full border border-slate-200 bg-white/95 p-1.5 shadow-[0_6px_20px_rgba(15,23,42,0.10)]"
          : "gap-2",
        className,
      )}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground",
            integrated ? "size-5 sm:left-4" : "size-4",
          )}
          aria-hidden
        />
        <Input
          type="search"
          name="q"
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={cn(
            "pl-10",
            integrated &&
              "h-11 rounded-full border-0 bg-transparent pr-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:h-12 sm:pl-11",
          )}
          aria-label="Rechercher des formations"
        />
      </div>
      <Button
        type="submit"
        disabled={pending}
        className={cn(
          integrated &&
            "h-10 shrink-0 rounded-full bg-[color:var(--brand-secondary)] px-4 shadow-[0_3px_10px_rgba(37,99,235,0.20)] sm:h-11 sm:px-6",
        )}
      >
        {pending ? "Recherche…" : "Rechercher"}
      </Button>
    </form>
  );
}
