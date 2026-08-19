"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type PanelKey = "information" | "program" | "learners" | "quality" | "management";

interface CourseDetailWorkspaceProps {
  information: ReactNode;
  program: ReactNode;
  learners?: ReactNode;
  quality: ReactNode;
  management: ReactNode;
}

const PANELS: Array<{ key: PanelKey; label: string }> = [
  { key: "information", label: "Informations" },
  { key: "program", label: "Programme" },
  { key: "learners", label: "Apprenants" },
  { key: "quality", label: "Qualité et publication" },
  { key: "management", label: "Gestion" },
];

/**
 * Réorganise les cinq zones métier sans dupliquer leurs formulaires.
 * Sous 1280 px, une seule zone reste visible et les flèches du clavier
 * déplacent le focus entre les onglets. Sur desktop, la même structure DOM
 * devient la grille compacte 8/4.
 */
export function CourseDetailWorkspace({
  information,
  program,
  learners,
  quality,
  management,
}: CourseDetailWorkspaceProps) {
  const panels = PANELS.filter((panel) => panel.key !== "learners" || learners);
  const [active, setActive] = useState<PanelKey>("information");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % panels.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + panels.length) % panels.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = panels.length - 1;
    else return;

    event.preventDefault();
    const key = panels[next]?.key;
    if (key) setActive(key);
    tabRefs.current[next]?.focus();
  }

  const content: Record<PanelKey, ReactNode | undefined> = {
    information,
    program,
    learners,
    quality,
    management,
  };

  function renderPanel(panel: { key: PanelKey; label: string }) {
    return (
      <section
        key={panel.key}
        id={`course-detail-panel-${panel.key}`}
        role="tabpanel"
        aria-labelledby={`course-detail-tab-${panel.key}`}
        tabIndex={0}
        className={cn(
          panel.key === active ? "block" : "hidden",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 xl:block xl:h-auto xl:min-h-0 xl:overflow-visible",
          panel.key === "information"
            ? "h-auto min-h-0"
            : "h-[calc(100dvh-12rem)] min-h-[26rem]",
        )}
      >
        {content[panel.key]}
      </section>
    );
  }

  const mainPanels = panels.filter((panel) =>
    (["information", "program", "learners"] as PanelKey[]).includes(panel.key),
  );
  const controlPanels = panels.filter((panel) =>
    (["quality", "management"] as PanelKey[]).includes(panel.key),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav
        role="tablist"
        aria-label="Sections de gestion de la formation"
        className="-mx-1 flex shrink-0 gap-1 overflow-x-auto border-b border-border px-1 pb-1 xl:hidden"
      >
        {panels.map((panel, index) => {
          const selected = panel.key === active;
          return (
            <button
              key={panel.key}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`course-detail-tab-${panel.key}`}
              aria-controls={`course-detail-panel-${panel.key}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(panel.key)}
              onKeyDown={(event) => moveFocus(event, index)}
              className={cn(
                "shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "bg-[color:var(--brand-primary)] text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {panel.label}
            </button>
          );
        })}
      </nav>

      <div
        className="mt-3 min-h-0 flex-1 xl:grid xl:grid-cols-12 xl:items-start xl:gap-3"
      >
        <div
          className={cn(
            "contents xl:col-span-8 xl:grid xl:min-h-0 xl:gap-3",
            learners
              ? "xl:grid-rows-[auto_auto_minmax(32rem,auto)]"
              : "xl:grid-rows-[auto_auto]",
          )}
        >
          {mainPanels.map(renderPanel)}
        </div>
        <div className="contents xl:sticky xl:top-0 xl:col-span-4 xl:grid xl:min-h-0 xl:grid-rows-[auto_auto] xl:gap-3">
          {controlPanels.map(renderPanel)}
        </div>
      </div>
    </div>
  );
}
