// Tabs filtres « Mon apprentissage » — Tous / En cours / Terminés / Wishlist.
// Le filtre est encodé dans l'URL (?filter=…) pour être bookmarkable et
// partageable, et compatible navigation arrière. Server component qui
// renvoie des <Link> classiques — aucun JS hydraté pour la nav.

import Link from "next/link";

import { cn } from "@/lib/utils";

export type LearningFilter = "all" | "in-progress" | "completed" | "wishlist";

interface LearningFilterTabsProps {
  active: LearningFilter;
  counts: Record<LearningFilter, number>;
}

const TABS: Array<{ key: LearningFilter; label: string }> = [
  { key: "all", label: "Tous mes cours" },
  { key: "in-progress", label: "En cours" },
  { key: "completed", label: "Terminés" },
  { key: "wishlist", label: "Liste d'envies" },
];

export function LearningFilterTabs({ active, counts }: LearningFilterTabsProps) {
  return (
    <nav
      aria-label="Filtrer mes cours"
      className="-mb-px flex flex-wrap gap-1 border-b border-border"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const count = counts[tab.key];
        return (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/apprentissage" : `/apprentissage?filter=${tab.key}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                isActive
                  ? "bg-[color:var(--brand-primary)] text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {count}
            </span>
            {isActive ? (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-0.5 bg-[color:var(--brand-primary)]"
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
