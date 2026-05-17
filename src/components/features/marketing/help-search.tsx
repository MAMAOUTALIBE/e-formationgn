"use client";

// Recherche client-side dans le centre d'aide.
// Index : tableau de { id, q, a, sectionId, sectionTitle } — filtré au
// fur et à mesure que l'utilisateur tape, avec match sur title + body
// (insensitive case + accents normalisés). Affiche les résultats sous
// l'input, et permet d'ancrer-cliquer directement sur la question.
//
// Aucune dépendance externe (pas de Fuse.js) — le dataset est petit
// (< 50 items), un simple .filter().includes() est largement suffisant
// et 100 fois plus léger pour l'utilisateur.

import { Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface HelpSearchItem {
  q: string;
  a: string;
  sectionId: string;
  sectionTitle: string;
}

interface HelpSearchProps {
  items: HelpSearchItem[];
  className?: string;
}

// Normalise une chaîne pour la recherche : minuscules + suppression des
// diacritiques (é → e, ç → c, …) — permet à « cle » de matcher « clé ».
function normalize(input: string): string {
  return input
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function HelpSearch({ items, className }: HelpSearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const normalized = useMemo(() => {
    return items.map((item) => ({
      ...item,
      _normalized: `${normalize(item.q)} ${normalize(item.a)}`,
    }));
  }, [items]);

  const trimmed = query.trim();
  const results = useMemo(() => {
    if (trimmed.length < 2) return [];
    const needle = normalize(trimmed);
    return normalized
      .filter((item) => item._normalized.includes(needle))
      .slice(0, 8);
  }, [normalized, trimmed]);

  return (
    <div className={cn("relative", className)}>
      <label htmlFor="help-search" className="sr-only">
        Rechercher dans le centre d&apos;aide
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={inputRef}
          id="help-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tapez votre question (ex : remboursement, certificat)…"
          className="h-12 w-full rounded-md border border-border bg-card pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:border-[color:var(--brand-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          autoComplete="off"
        />
        {query.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Effacer la recherche"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {trimmed.length >= 2 ? (
        <div
          className="mt-2 overflow-hidden rounded-md border border-border bg-card shadow-lg"
          role="region"
          aria-live="polite"
          aria-label={`${results.length} résultat${results.length > 1 ? "s" : ""}`}
        >
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Aucun résultat pour « {trimmed} ». Essayez d&apos;autres mots-clés
              ou contactez le support.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((item, index) => (
                <li key={`${item.sectionId}-${index}`}>
                  <a
                    href={`#${item.sectionId}`}
                    onClick={() => {
                      // Ferme les résultats après clic.
                      setQuery("");
                    }}
                    className="block px-4 py-3 text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-primary)]">
                      {item.sectionTitle}
                    </p>
                    <p className="mt-0.5 font-medium text-foreground">
                      {item.q}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
