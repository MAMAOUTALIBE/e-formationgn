"use client";

// Barre de recherche globale du header — autocomplete via /api/recherche.
// Comportement clavier :
//   - ↑/↓ : navigue dans les suggestions
//   - Enter : ouvre la suggestion sélectionnée, ou /cours?q=... si rien de sélectionné
//   - Esc : ferme le popover

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
}

export function HeaderSearch({ className }: { className?: string }) {
  const router = useRouter();
  const listboxId = useId();
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce : on attend 180ms après la dernière frappe avant de fetch.
  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/recherche?q=${encodeURIComponent(term)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { items: Suggestion[] };
        setSuggestions(data.items);
        setActiveIndex(-1);
      } catch {
        /* offline / abort — silence */
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [value]);

  const visibleSuggestions = value.trim().length >= 2 ? suggestions : [];

  // Fermeture au clic extérieur.
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const goToCatalog = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      setOpen(false);
      router.push(`/cours?q=${encodeURIComponent(trimmed)}`);
    },
    [router],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeIndex >= 0 && visibleSuggestions[activeIndex]) {
      setOpen(false);
      router.push(`/cours/${visibleSuggestions[activeIndex].slug}`);
      return;
    }
    goToCatalog(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, visibleSuggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const showPopover = open && value.trim().length >= 2;

  return (
    <div ref={containerRef} className={cn("relative w-full max-w-md", className)}>
      <form role="search" onSubmit={handleSubmit} className="flex items-center">
        <div className="relative w-full">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            name="q"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher une formation…"
            aria-label="Rechercher une formation"
            // `role="combobox"` est indispensable, pas décoratif : un
            // `input type="search"` expose nativement le rôle `searchbox`, qui
            // n'admet PAS `aria-expanded`. Sans ce rôle, l'attribut était
            // ignoré et les lecteurs d'écran n'annonçaient jamais l'ouverture
            // de la liste de suggestions — le champ paraissait sans effet.
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={showPopover}
            className="pl-10"
          />
        </div>
      </form>

      {showPopover && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-md border border-border bg-popover shadow-lg"
        >
          {visibleSuggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Aucun résultat. Appuyez sur Entrée pour ouvrir le catalogue.
            </p>
          ) : (
            <ul className="max-h-80 overflow-auto py-1">
              {visibleSuggestions.map((s, index) => (
                <li key={s.id}>
                  <Link
                    href={`/cours/${s.slug}`}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => setActiveIndex(index)}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={cn(
                      "flex flex-col gap-0.5 px-4 py-2 text-sm transition-colors",
                      index === activeIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/60",
                    )}
                  >
                    <span className="font-medium">{s.title}</span>
                    {s.subtitle && (
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {s.subtitle}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
              <li className="border-t border-border">
                <button
                  type="button"
                  onClick={() => goToCatalog(value)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                >
                  <Search className="h-3.5 w-3.5" aria-hidden />
                  Voir tous les résultats pour « {value.trim()} »
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
