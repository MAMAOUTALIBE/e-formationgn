"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface AdminSidebarLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  /** Match strict ou par préfixe (par défaut). */
  exact?: boolean;
}

export function AdminSidebarLink({
  href,
  icon,
  label,
  badge,
  exact,
}: AdminSidebarLinkProps) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        // Chaque couleur suit la barre latérale si l'admin en a choisi une
        // (cf. /admin/parametres/branding), sinon retombe sur la charte.
        active
          ? "bg-[color:var(--admin-sidebar-active-bg,color-mix(in_srgb,var(--brand-primary)_10%,transparent))] text-[color:var(--admin-sidebar-active-fg,var(--brand-primary))]"
          : "text-[color:var(--admin-sidebar-muted,var(--muted-foreground))] hover:bg-[color:var(--admin-sidebar-hover,var(--muted))] hover:text-[color:var(--admin-sidebar-fg,var(--foreground))]",
      )}
    >
      <span
        className={cn(
          "text-[color:var(--admin-sidebar-muted,var(--muted-foreground))]",
          active && "text-[color:var(--admin-sidebar-active-fg,var(--brand-primary))]",
        )}
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {badge && badge > 0 ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}
