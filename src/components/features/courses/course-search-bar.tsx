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
}

export function CourseSearchBar({
  className,
  placeholder = "Rechercher un cours, un sujet, un formateur…",
  redirectToCatalog = false,
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
      className={cn("flex w-full items-center gap-2", className)}
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          name="q"
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="pl-10"
          aria-label="Rechercher des cours"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Recherche…" : "Rechercher"}
      </Button>
    </form>
  );
}
