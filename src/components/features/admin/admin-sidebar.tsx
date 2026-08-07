"use client";

// Barre latérale du CRM (desktop, ≥ lg). Sur mobile c'est
// <AdminMobileSidebar> qui prend le relais avec la même <AdminNav>.
//
// Le composant rend son propre <aside> parce qu'il pilote sa largeur : le
// bouton « Réduire le menu » bascule entre le menu complet et un rail
// d'icônes, ce que le layout serveur ne peut pas décider.

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AdminNav } from "@/components/features/admin/admin-nav";
import { Logo } from "@/components/branding/logo";
import type { AdminNavGroupId } from "@/lib/admin/navigation";
import {
  SIDEBAR_COLLAPSED_COOKIE,
  persistSidebarCookie,
} from "@/lib/admin/sidebar-preferences";
import { cn } from "@/lib/utils";
import type { AdminSidebarBadges } from "@/server/queries/admin-sidebar";

interface AdminSidebarProps {
  badges: AdminSidebarBadges;
  defaultCollapsed: boolean;
  defaultClosedGroups: AdminNavGroupId[];
}

export function AdminSidebar({
  badges,
  defaultCollapsed,
  defaultClosedGroups,
}: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    persistSidebarCookie(SIDEBAR_COLLAPSED_COOKIE, next ? "1" : "0");
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col overflow-hidden border-r border-[color:var(--admin-sidebar-border,var(--border))] bg-[color:var(--admin-sidebar-bg,var(--background))] text-[color:var(--admin-sidebar-fg,var(--foreground))] transition-[width] duration-200 lg:flex",
        collapsed ? "lg:w-[4.75rem]" : "lg:w-64",
      )}
    >
      {/* Le logo est posé sur une carte blanche : la barre latérale est
          recolorable (cf. /admin/parametres/branding) et le wordmark bleu
          marine deviendrait illisible sur un fond sombre. */}
      <div className={cn("shrink-0 pt-4", collapsed ? "px-2" : "px-3")}>
        <Link
          href="/"
          aria-label="Retour à l'accueil"
          className="flex items-center justify-center rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md"
        >
          <Logo variant={collapsed ? "mark" : "default"} width={collapsed ? 90 : 140} />
        </Link>
      </div>

      {/* Seule la liste défile : le bouton de réduction reste toujours
          atteignable, même sur un écran court. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <AdminNav
          badges={badges}
          collapsed={collapsed}
          defaultClosedGroups={defaultClosedGroups}
        />
      </div>

      <div
        className={cn(
          "shrink-0 border-t border-[color:var(--admin-sidebar-border,var(--border))] p-2",
        )}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          title={collapsed ? "Déployer le menu" : "Réduire le menu"}
          className={cn(
            "flex w-full items-center rounded-lg py-2 text-sm font-medium text-[color:var(--admin-sidebar-muted,var(--muted-foreground))] transition-colors hover:bg-[color:var(--admin-sidebar-hover,var(--muted))] hover:text-[color:var(--admin-sidebar-fg,var(--foreground))]",
            collapsed ? "justify-center px-0" : "gap-2.5 px-3",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className={collapsed ? "sr-only" : undefined}>
            {collapsed ? "Déployer le menu" : "Réduire le menu"}
          </span>
        </button>
      </div>
    </aside>
  );
}
