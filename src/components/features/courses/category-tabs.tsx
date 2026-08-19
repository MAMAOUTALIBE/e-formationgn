"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface CategoryTab {
  slug: string;
  label: string;
  content: ReactNode;
}

interface CategoryTabsProps {
  tabs: CategoryTab[];
  className?: string;
}

export function CategoryTabs({ tabs, className }: CategoryTabsProps) {
  const [activeSlug, setActiveSlug] = useState(tabs[0]?.slug ?? "");

  if (tabs.length === 0) return null;

  const active = tabs.find((tab) => tab.slug === activeSlug) ?? tabs[0];

  return (
    <div className={cn("w-full", className)}>
      <div
        role="tablist"
        aria-label="Catégories de formations"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {tabs.map((tab) => {
          const isActive = tab.slug === active.slug;
          return (
            <button
              key={tab.slug}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tab-panel-${tab.slug}`}
              id={`tab-${tab.slug}`}
              onClick={() => setActiveSlug(tab.slug)}
              className={cn(
                "relative -mb-px px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-[color:var(--brand-violet)]"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.slug}
          role="tabpanel"
          id={`tab-panel-${tab.slug}`}
          aria-labelledby={`tab-${tab.slug}`}
          hidden={tab.slug !== active.slug}
          className="mt-8"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
