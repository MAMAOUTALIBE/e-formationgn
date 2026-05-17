"use client";

// Tabs sous le player de leçon — barre horizontale type Udemy.
// État local (useState) ; pas de routing pour éviter un re-render serveur
// quand l'élève switch entre « Présentation » et « Notes » par exemple.

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface LearningTab {
  key: string;
  label: string;
  /** Pastille optionnelle (ex: nombre de questions Q&R). */
  badge?: string | number;
  content: ReactNode;
}

interface LearningTabsProps {
  tabs: LearningTab[];
  /** Onglet sélectionné par défaut (clé). Défaut = premier tab. */
  defaultKey?: string;
  className?: string;
}

export function LearningTabs({ tabs, defaultKey, className }: LearningTabsProps) {
  const [activeKey, setActiveKey] = useState(defaultKey ?? tabs[0]?.key ?? "");
  if (tabs.length === 0) return null;
  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  return (
    <div className={cn("w-full", className)}>
      <div
        role="tablist"
        aria-label="Onglets de la leçon"
        className="flex flex-wrap items-center gap-1 border-b border-border"
      >
        {tabs.map((tab) => {
          const isActive = tab.key === active.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`learning-tab-${tab.key}`}
              id={`learning-tab-trigger-${tab.key}`}
              onClick={() => setActiveKey(tab.key)}
              className={cn(
                "relative -mb-px inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.badge !== undefined ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                  {tab.badge}
                </span>
              ) : null}
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-[color:var(--brand-primary)]"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`learning-tab-${tab.key}`}
          aria-labelledby={`learning-tab-trigger-${tab.key}`}
          hidden={tab.key !== active.key}
          className="pt-6"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
