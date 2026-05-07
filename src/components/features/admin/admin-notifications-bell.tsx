"use client";

// Cloche admin — agrège les badges de la sidebar en notifications synthétiques.
// Pas de modèle Notification dédié (on réutilise les compteurs déjà calculés
// pour la sidebar). Cliquer une notif emmène vers le module concerné.

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { AdminSidebarBadges } from "@/server/queries/admin-sidebar";

interface NotificationItem {
  key: keyof AdminSidebarBadges;
  count: number;
  label: string;
  href: string;
  tone: "info" | "warning" | "danger";
}

export function AdminNotificationsBell({ badges }: { badges: AdminSidebarBadges }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const items: NotificationItem[] = ([
    {
      key: "pendingCourses",
      count: badges.pendingCourses,
      label: `${badges.pendingCourses} cours en attente de modération`,
      href: "/admin/cours/moderation",
      tone: "warning",
    },
    {
      key: "openTickets",
      count: badges.openTickets,
      label: `${badges.openTickets} ticket${badges.openTickets > 1 ? "s" : ""} de support ouvert${badges.openTickets > 1 ? "s" : ""}`,
      href: "/admin/support/tickets",
      tone: "info",
    },
    {
      key: "openDisputes",
      count: badges.openDisputes,
      label: `${badges.openDisputes} litige${badges.openDisputes > 1 ? "s" : ""} ouvert${badges.openDisputes > 1 ? "s" : ""}`,
      href: "/admin/support/litiges",
      tone: "danger",
    },
    {
      key: "pendingReports",
      count: badges.pendingReports,
      label: `${badges.pendingReports} signalement${badges.pendingReports > 1 ? "s" : ""} à traiter`,
      href: "/admin/moderation/signalements",
      tone: "warning",
    },
    {
      key: "pendingGdpr",
      count: badges.pendingGdpr,
      label: `${badges.pendingGdpr} demande${badges.pendingGdpr > 1 ? "s" : ""} RGPD`,
      href: "/admin/securite/rgpd",
      tone: "info",
    },
  ] satisfies NotificationItem[]).filter((it) => it.count > 0);

  const total = items.reduce((sum, it) => sum + it.count, 0);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications administrateur"
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {total > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-md border border-border bg-popover shadow-lg">
          <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notifications administrateur
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Aucune action requise. ✓
            </p>
          ) : (
            <ul className="max-h-80 overflow-auto py-1">
              {items.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-start gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1 inline-block h-2 w-2 shrink-0 rounded-full",
                        item.tone === "danger"
                          ? "bg-red-500"
                          : item.tone === "warning"
                            ? "bg-amber-500"
                            : "bg-[color:var(--brand-secondary)]",
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
