"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export function CourseDescription({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const canExpand = description.length > 100 || description.split("\n").length > 2;

  function closeDescription() {
    setExpanded(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!expanded) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setExpanded(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [expanded]);

  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">Description</p>
      <div className="mt-1 flex items-end gap-2">
        <p
          id="course-description"
          className="line-clamp-3 min-w-0 flex-1 whitespace-pre-line text-sm leading-5 text-foreground xl:line-clamp-2"
        >
          {description || "Aucune description n’a encore été renseignée."}
        </p>
        {canExpand ? (
          <Button
            ref={triggerRef}
            type="button"
            variant="link"
            size="sm"
            aria-haspopup="dialog"
            onClick={() => setExpanded(true)}
            className="h-auto shrink-0 px-0 py-0 text-xs"
          >
            Voir plus
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="course-description-title">
          <button
            type="button"
            aria-label="Fermer la description"
            className="absolute inset-0 bg-black/40"
            onClick={closeDescription}
          />
          <div className="relative flex max-h-[min(70dvh,42rem)] w-full max-w-2xl flex-col rounded-xl border border-border bg-background shadow-xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 id="course-description-title" className="text-base font-semibold text-foreground">Description de la formation</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                autoFocus
                aria-label="Fermer"
                onClick={closeDescription}
                className="h-9 w-9"
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <p className="overflow-y-auto whitespace-pre-line px-4 py-4 text-sm leading-6 text-foreground">
              {description}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
