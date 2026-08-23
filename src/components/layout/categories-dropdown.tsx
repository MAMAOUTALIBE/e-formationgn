"use client";

// Dropdown « Catégories » dans le header — version compacte du mega-menu
// Udemy. Au survol (desktop) OU au clic (clavier/touch), affiche la liste
// des catégories actives avec leur nom + lien direct.
//
// Reste accessible : aria-expanded + focus visible + Echap pour fermer.
// Le hover n'est qu'un + visuel : tout marche au clavier.

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface CategoryEntry {
  slug: string;
  name: string;
}

interface CategoriesDropdownProps {
  categories: CategoryEntry[];
  /** Label affiché — passe par i18n côté caller. */
  label: string;
}

export function CategoriesDropdown({ categories, label }: CategoriesDropdownProps) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fermeture par Échap ou clic en-dehors.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (
        !buttonRef.current?.contains(t) &&
        !panelRef.current?.contains(t)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  function openWithoutDelay() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpen(true);
  }

  function scheduleClose() {
    // Petit délai pour éviter de fermer si la souris passe entre le bouton
    // et le panneau (la zone sans hover entre les deux est inévitable).
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 150);
  }

  return (
    <div
      className="relative"
      onMouseEnter={openWithoutDelay}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        onFocus={openWithoutDelay}
        className="inline-flex items-center gap-1 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="menu"
          aria-label={label}
          className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-xl"
          onMouseEnter={openWithoutDelay}
          onMouseLeave={scheduleClose}
        >
          <ul className="max-h-[60vh] overflow-y-auto py-1">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/categories/${c.slug}`}
                  role="menuitem"
                  className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  onClick={() => setOpen(false)}
                >
                  <span>{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-border bg-muted/30 px-4 py-2">
            <Link
              href="/categories"
              className="inline-flex min-h-6 items-center text-xs font-semibold text-[color:var(--brand-secondary)] hover:underline"
              onClick={() => setOpen(false)}
            >
              Voir toutes les catégories →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
