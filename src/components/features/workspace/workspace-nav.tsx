"use client";

// Liste de navigation d'un espace de travail, partagée par la barre latérale
// (desktop) et le drawer mobile, quel que soit l'espace.
//
// Elle ne connaît aucun espace en particulier : tout vient de la navigation
// résolue qu'on lui passe, déjà filtrée pour le rôle courant.

import {
  Award,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpenText,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  GaugeCircle,
  GraduationCap,
  Heart,
  LifeBuoy,
  Link as LinkIcon,
  Megaphone,
  PlayCircle,
  Settings2,
  Shield,
  Star,
  Tag,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  isNavItemActive,
  type ResolvedWorkspaceNav,
  type WorkspaceIconName,
  type WorkspaceSection,
} from "@/lib/workspace/navigation";
import {
  closedGroupsCookieName,
  persistSidebarCookie,
  serializeClosedGroups,
} from "@/lib/workspace/preferences";
import { cn } from "@/lib/utils";

const ICONS: Record<WorkspaceIconName, LucideIcon> = {
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
  calendar: CalendarDays,
  star: Star,
  tag: Tag,
  link: LinkIcon,
  help: CircleHelp,
  certificate: Award,
  heart: Heart,
  bell: Bell,
  play: PlayCircle,
  building: Building2,
};

/** Compteurs affichés en pastille, indexés par les `badgeKeys` du registre. */
export type WorkspaceBadges = Record<string, number>;

interface WorkspaceNavProps {
  nav: ResolvedWorkspaceNav;
  badges: WorkspaceBadges;
  /** Rail d'icônes seules — le libellé passe en infobulle native. */
  collapsed?: boolean;
  /** Groupes repliés au premier rendu (issus du cookie, lu côté serveur). */
  defaultClosedGroups?: string[];
}

export function WorkspaceNav({
  nav,
  badges,
  collapsed = false,
  defaultClosedGroups = [],
}: WorkspaceNavProps) {
  const pathname = usePathname();
  const [closedGroups, setClosedGroups] = useState<string[]>(defaultClosedGroups);

  function toggleGroup(id: string) {
    const next = closedGroups.includes(id)
      ? closedGroups.filter((g) => g !== id)
      : [...closedGroups, id];
    setClosedGroups(next);
    persistSidebarCookie(closedGroupsCookieName(nav.id), serializeClosedGroups(next));
  }

  return (
    <nav
      className={cn("flex flex-col gap-1 py-4 text-sm", collapsed ? "px-2" : "px-3")}
      aria-label={`Navigation ${nav.label}`}
    >
      {nav.pinned.map((section) => (
        <WorkspaceNavLink
          key={section.href}
          section={section}
          rootHref={nav.pinned[0]?.href ?? section.href}
          badges={badges}
          pathname={pathname}
          collapsed={collapsed}
        />
      ))}

      {nav.groups.map((group) => {
        // Un groupe replié qui contient la page courante resterait invisible
        // alors qu'il est actif : on le force ouvert dans ce cas.
        const rootHref = nav.pinned[0]?.href ?? "";
        const holdsActive = group.sections.some((s) =>
          isNavItemActive(s.href, pathname, rootHref),
        );
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
                  <WorkspaceNavLink
                    key={section.href}
                    section={section}
                    rootHref={rootHref}
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

function WorkspaceNavLink({
  section,
  rootHref,
  badges,
  pathname,
  collapsed,
}: {
  section: WorkspaceSection;
  rootHref: string;
  badges: WorkspaceBadges;
  pathname: string;
  collapsed: boolean;
}) {
  const active = isNavItemActive(section.href, pathname, rootHref);
  const Icon = ICONS[section.icon];
  const badge = (section.badgeKeys ?? []).reduce(
    (total, key) => total + (badges[key] ?? 0),
    0,
  );

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
