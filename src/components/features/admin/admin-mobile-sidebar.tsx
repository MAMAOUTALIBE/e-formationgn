"use client";

// Drawer slide-in pour la sidebar admin sur mobile (< lg).
// Bouton hamburger dans le header admin → ouvre l'AdminSidebar dans un
// panneau full-height à gauche. Lock du scroll arrière-plan, fermeture
// au clic backdrop ou Escape.

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AdminNav } from "@/components/features/admin/admin-nav";
import type { AdminNavGroupId } from "@/lib/admin/navigation";
import type { AdminSidebarBadges } from "@/server/queries/admin-sidebar";

interface AdminMobileSidebarProps {
  badges: AdminSidebarBadges;
  defaultClosedGroups: AdminNavGroupId[];
}

export function AdminMobileSidebar({
  badges,
  defaultClosedGroups,
}: AdminMobileSidebarProps) {
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
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-muted lg:hidden"
        aria-label="Ouvrir la navigation admin"
        aria-expanded={open}
        aria-controls="admin-sidebar-drawer"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Fermer la navigation admin"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <aside
            id="admin-sidebar-drawer"
            className="absolute left-0 top-0 flex h-full w-full max-w-xs flex-col bg-background shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">
                Navigation admin
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AdminNav badges={badges} defaultClosedGroups={defaultClosedGroups} />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
