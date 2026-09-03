"use client";

// Dropdown « Catégories » dans le header — version compacte du mega-menu
// Udemy. Au survol (desktop) OU au clic (clavier/touch), affiche la liste
// des catégories actives avec leur nom + lien direct.
//
// Reste accessible : aria-expanded + focus visible + Echap pour fermer.
// Le hover n'est qu'un + visuel : tout marche au clavier.

import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const isActive = pathname === "/categories" || pathname.startsWith("/categories/");
  const closeTimerRef = useRef<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLUListElement>(null);

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

  function scrollCategories(direction: -1 | 1) {
    const list = categoriesRef.current;
    if (!list) return;

    list.scrollBy({
      left: direction * Math.max(list.clientWidth * 0.75, 180),
      behavior: "smooth",
    });
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
        aria-current={isActive ? "page" : undefined}
        onClick={() => setOpen((o) => !o)}
        onFocus={openWithoutDelay}
        className={cn(
          "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold shadow-[0_3px_12px_rgba(15,23,42,0.05)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
          isActive
            ? "border-emerald-200 bg-emerald-50 text-[color:var(--brand-primary)]"
            : "border-slate-200/80 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-[color:var(--brand-primary)]",
        )}
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
          className="fixed left-1/2 top-[4.75rem] z-50 flex w-[calc(100vw-1.5rem)] max-w-6xl -translate-x-1/2 flex-wrap items-center gap-2 overflow-hidden rounded-xl border border-border bg-card p-2 shadow-xl sm:flex-nowrap sm:gap-3 sm:p-3"
          onMouseEnter={openWithoutDelay}
          onMouseLeave={scheduleClose}
        >
          <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto sm:gap-3">
            <button
              type="button"
              aria-label="Faire défiler les catégories vers la gauche"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-sky-300 hover:text-[color:var(--brand-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:size-9"
              onClick={() => scrollCategories(-1)}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>

            <ul
              ref={categoriesRef}
              role="menu"
              aria-label={label}
              className="flex min-w-0 flex-1 flex-nowrap items-center gap-3 overflow-x-auto scroll-smooth whitespace-nowrap py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {categories.map((c) => (
                <li
                  key={c.slug}
                  className="flex shrink-0 items-center gap-3 after:h-4 after:w-px after:bg-border last:after:hidden"
                >
                  <Link
                    href={`/categories/${c.slug}`}
                    role="menuitem"
                    className="py-1.5 text-sm font-medium text-foreground transition-colors hover:text-[color:var(--brand-secondary)] hover:underline hover:underline-offset-4 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    onClick={() => setOpen(false)}
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>

            <button
              type="button"
              aria-label="Faire défiler les catégories vers la droite"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-sky-300 hover:text-[color:var(--brand-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:size-9"
              onClick={() => scrollCategories(1)}
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>

          <Link
            href="/categories"
            className="ml-auto inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full bg-[color:var(--brand-secondary)] px-3 text-xs font-semibold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 sm:px-4 sm:text-sm"
            onClick={() => setOpen(false)}
          >
            Voir toutes les catégories →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
