"use client";

// Liste de navigation du CRM, partagée par la barre latérale (desktop) et le
// drawer mobile. Elle est entièrement pilotée par le registre
// `ADMIN_SECTIONS` : ajouter une section là-bas la fait apparaître ici, dans
// son groupe, avec son icône et sa pastille.

import {
  AlertTriangle,
  BarChart3,
  BookOpenText,
  ChevronDown,
  GaugeCircle,
  GraduationCap,
  LifeBuoy,
  Megaphone,
  Settings2,
  Shield,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  ADMIN_GROUPED_SECTIONS,
  ADMIN_PINNED_SECTIONS,
  type AdminIconName,
  type AdminNavGroupId,
  type AdminSection,
} from "@/lib/admin/navigation";
import {
  SIDEBAR_CLOSED_GROUPS_COOKIE,
  persistSidebarCookie,
  serializeClosedGroups,
} from "@/lib/admin/sidebar-preferences";
import { cn } from "@/lib/utils";
import type { AdminSidebarBadges } from "@/server/queries/admin-sidebar";

const ICONS: Record<AdminIconName, LucideIcon> = {
  gauge: GaugeCircle,
  chart: BarChart3,
  wallet: Wallet,
  megaphone: Megaphone,
  users: Users,
  graduation: GraduationCap,
  lifebuoy: LifeBuoy,
  book: BookOpenText,
  alert: AlertTriangle,
  settings: Settings2,
  shield: Shield,
};

interface AdminNavProps {
  badges: AdminSidebarBadges;
  /** Rail d'icônes seules — le libellé passe en infobulle native. */
  collapsed?: boolean;
  /** Groupes repliés au premier rendu (issus du cookie, lu côté serveur). */
  defaultClosedGroups?: AdminNavGroupId[];
}

export function AdminNav({
  badges,
  collapsed = false,
  defaultClosedGroups = [],
}: AdminNavProps) {
  const pathname = usePathname();
  const [closedGroups, setClosedGroups] = useState<AdminNavGroupId[]>(defaultClosedGroups);

  function toggleGroup(id: AdminNavGroupId) {
    const next = closedGroups.includes(id)
      ? closedGroups.filter((g) => g !== id)
      : [...closedGroups, id];
    setClosedGroups(next);
    persistSidebarCookie(SIDEBAR_CLOSED_GROUPS_COOKIE, serializeClosedGroups(next));
  }

  return (
    <nav
      className={cn("flex flex-col gap-1 py-4 text-sm", collapsed ? "px-2" : "px-3")}
      aria-label="Navigation admin"
    >
      {ADMIN_PINNED_SECTIONS.map((section) => (
        <AdminNavLink
          key={section.href}
          section={section}
          badges={badges}
          pathname={pathname}
          collapsed={collapsed}
        />
      ))}

      {ADMIN_GROUPED_SECTIONS.map((group) => {
        // Un groupe replié qui contient la page courante resterait invisible
        // alors qu'il est actif : on le force ouvert dans ce cas.
        const holdsActive = group.sections.some((s) => isActive(s, pathname));
        const open = holdsActive || !closedGroups.includes(group.id);

        return (
          <div key={group.id} className="mt-3">
            {collapsed ? (
              // En rail, l'en-tête textuel n'a pas la place : un simple filet
              // sépare les groupes et préserve le rythme du menu.
              <div
                aria-hidden
                className="mx-2 mb-2 border-t border-[color:var(--admin-sidebar-border,var(--border))]"
              />
            ) : (
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={open}
                className="mb-1 flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--admin-sidebar-muted,var(--muted-foreground))] transition-colors hover:text-[color:var(--admin-sidebar-fg,var(--foreground))]"
              >
                <span className="truncate">{group.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform",
                    !open && "-rotate-90",
                  )}
                  aria-hidden
                />
              </button>
            )}

            {open ? (
              <div className="flex flex-col gap-0.5">
                {group.sections.map((section) => (
                  <AdminNavLink
                    key={section.href}
                    section={section}
                    badges={badges}
                    pathname={pathname}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

/** `/admin` ne matche qu'exactement, sinon il serait actif sur tout le CRM. */
function isActive(section: AdminSection, pathname: string): boolean {
  if (section.href === "/admin") return pathname === "/admin";
  return pathname === section.href || pathname.startsWith(`${section.href}/`);
}

function AdminNavLink({
  section,
  badges,
  pathname,
  collapsed,
}: {
  section: AdminSection;
  badges: AdminSidebarBadges;
  pathname: string;
  collapsed: boolean;
}) {
  const active = isActive(section, pathname);
  const Icon = ICONS[section.icon];
  const badge = (section.badgeKeys ?? []).reduce((total, key) => total + badges[key], 0);

  return (
    <Link
      href={section.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? section.label : undefined}
      className={cn(
        "group relative flex items-center rounded-lg font-medium transition-colors",
        collapsed ? "h-10 w-10 justify-center self-center" : "gap-2.5 px-3 py-2",
        active
          ? "bg-[color:var(--admin-sidebar-active-bg,color-mix(in_srgb,var(--brand-primary)_10%,transparent))] font-semibold text-[color:var(--admin-sidebar-active-fg,var(--brand-primary))] shadow-sm"
          : "text-[color:var(--admin-sidebar-muted,var(--muted-foreground))] hover:bg-[color:var(--admin-sidebar-hover,var(--muted))] hover:text-[color:var(--admin-sidebar-fg,var(--foreground))]",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />

      {collapsed ? (
        <>
          <span className="sr-only">{section.label}</span>
          {badge > 0 ? (
            // En rail, le compteur ne tient pas : une pastille suffit à
            // signaler qu'il y a quelque chose à traiter dans la section.
            <span
              aria-hidden
              className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[color:var(--admin-sidebar-bg,var(--background))]"
            />
          ) : null}
        </>
      ) : (
        <>
          <span className="flex-1 truncate">{section.label}</span>
          {badge > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          ) : null}
        </>
      )}
    </Link>
  );
}
