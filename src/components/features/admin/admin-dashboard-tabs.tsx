// Onglets du tableau de bord : Pilotage / Analyse / Activité.
//
// L'onglet actif vit dans l'URL (`?vue=`) plutôt que dans un état React : la
// page reste un composant serveur, chaque onglet ne charge QUE ses propres
// requêtes, et une vue peut être mise en favori ou partagée telle quelle.

import Link from "next/link";

import { cn } from "@/lib/utils";

export const DASHBOARD_VIEWS = ["pilotage", "analyse", "activite"] as const;
export type DashboardView = (typeof DASHBOARD_VIEWS)[number];

export const DEFAULT_DASHBOARD_VIEW: DashboardView = "pilotage";

export function isDashboardView(value: string): value is DashboardView {
  return (DASHBOARD_VIEWS as readonly string[]).includes(value);
}

const LABELS: Record<DashboardView, string> = {
  pilotage: "Pilotage",
  analyse: "Analyse",
  activite: "Activité",
};

interface AdminDashboardTabsProps {
  current: DashboardView;
  /** Période active, conservée en changeant d'onglet. */
  period: string | null;
}

export function AdminDashboardTabs({ current, period }: AdminDashboardTabsProps) {
  return (
    <nav
      aria-label="Vues du tableau de bord"
      className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1"
    >
      {DASHBOARD_VIEWS.map((view) => {
        const params = new URLSearchParams();
        if (period) params.set("period", period);
        if (view !== DEFAULT_DASHBOARD_VIEW) params.set("vue", view);
        const query = params.toString();
        const active = current === view;

        return (
          <Link
            key={view}
            href={query ? `/admin?${query}` : "/admin"}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LABELS[view]}
          </Link>
        );
      })}
    </nav>
  );
}
