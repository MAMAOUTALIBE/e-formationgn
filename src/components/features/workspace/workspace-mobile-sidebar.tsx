"use client";

// Drawer slide-in pour la barre latérale sur mobile (< lg).
// Bouton hamburger dans le header → ouvre la <WorkspaceNav> dans un panneau
// pleine hauteur à gauche. Lock du scroll arrière-plan, fermeture au clic
// backdrop ou Escape.

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  WorkspaceNav,
  type WorkspaceBadges,
} from "@/components/features/workspace/workspace-nav";
import { ThemeToggle } from "@/components/features/theme/theme-toggle";
import type { ResolvedWorkspaceNav } from "@/lib/workspace/navigation";

interface WorkspaceMobileSidebarProps {
  nav: ResolvedWorkspaceNav;
  badges: WorkspaceBadges;
  defaultClosedGroups: string[];
}

export function WorkspaceMobileSidebar({
  nav,
  badges,
  defaultClosedGroups,
}: WorkspaceMobileSidebarProps) {
  // On dérive `open` du couple (openedAtPath, pathname courant) plutôt que
  // de gérer la fermeture sur changement de route via un useEffect (anti-
  // pattern React 19 / React Compiler). Quand l'utilisateur clique un lien,
  // pathname change → openedAtPath !== pathname → drawer se referme.
  const pathname = usePathname();
  const [openedAtPath, setOpenedAtPath] = useState<string | null>(null);
  const open = openedAtPath !== null && openedAtPath === pathname;

  const setOpen = (next: boolean) => {
    setOpenedAtPath(next ? pathname : null);
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenedAtPath(null);
    }
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground hover:bg-muted lg:hidden"
        aria-label="Ouvrir la navigation"
        aria-expanded={open}
        aria-controls="workspace-sidebar-drawer"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Fermer la navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <aside
            id="workspace-sidebar-drawer"
            className="absolute left-0 top-0 flex h-[100dvh] w-[min(88vw,20rem)] flex-col bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">{nav.label}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <WorkspaceNav
                nav={nav}
                badges={badges}
                defaultClosedGroups={defaultClosedGroups}
              />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 md:hidden">
              <span className="text-sm font-medium text-foreground">Apparence</span>
              <ThemeToggle />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
