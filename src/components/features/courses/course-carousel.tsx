"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

interface CourseCarouselProps {
  children: React.ReactNode;
  className?: string;
  /** Quand cette clé change, le scroll revient au début (utile sur changement de filtres). */
  resetKey?: string;
}

export function CourseCarousel({
  children,
  className,
  resetKey,
}: CourseCarouselProps) {
  const slides = React.Children.toArray(children);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = React.useState(false);
  const [canNext, setCanNext] = React.useState(false);
  const [pageCount, setPageCount] = React.useState(1);
  const [activePage, setActivePage] = React.useState(0);

  const updateState = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, clientWidth, scrollWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    setCanPrev(scrollLeft > 1);
    setCanNext(scrollLeft < maxScroll - 1);
    const pages = clientWidth > 0 ? Math.max(1, Math.ceil(scrollWidth / clientWidth)) : 1;
    setPageCount(pages);
    const current = clientWidth > 0 ? Math.round(scrollLeft / clientWidth) : 0;
    setActivePage(Math.min(current, pages - 1));
  }, []);

  React.useEffect(() => {
    updateState();
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => updateState();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(updateState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [updateState, slides.length]);

  const scrollByPage = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  };

  const scrollToPage = (page: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: page * el.clientWidth, behavior: "smooth" });
  };

  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: 0 });
  }, [resetKey]);

  if (slides.length === 0) {
    return null;
  }

  // Quand il y a peu de cartes (≤ 3), on rend en grille — pas besoin de
  // carousel, ça évite l'effet "card seule à gauche, gros vide à droite".
  if (slides.length <= 3) {
    return (
      <div
        className={cn(
          "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3",
          className,
        )}
      >
        {slides.map((slide, i) => (
          <div key={i}>{slide}</div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <div
          ref={scrollerRef}
          className="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              className="snap-start shrink-0 basis-full sm:basis-[calc((100%-1.5rem)/2)] lg:basis-[calc((100%-3rem)/3)]"
            >
              {slide}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => scrollByPage(-1)}
          disabled={!canPrev}
          aria-label="Cours précédents"
          className="absolute left-0 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition hover:bg-muted disabled:pointer-events-none disabled:opacity-0 sm:flex h-10 w-10"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => scrollByPage(1)}
          disabled={!canNext}
          aria-label="Cours suivants"
          className="absolute right-0 top-1/2 hidden translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition hover:bg-muted disabled:pointer-events-none disabled:opacity-0 sm:flex h-10 w-10"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {pageCount > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToPage(i)}
              aria-label={`Aller au groupe ${i + 1}`}
              aria-current={i === activePage ? "true" : undefined}
              className={cn(
                "h-2 rounded-full transition-all",
                i === activePage
                  ? "w-6 bg-[color:var(--brand-secondary)]"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
