"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface InstructorNavItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  /** Match exact (pour /formateur, préfixe de toutes les autres routes). */
  exact?: boolean;
}

// Sidebar « nuit » (Navy profond minimal) : fond slate #0F172A, item actif
// signalé par une barre latérale ciel + un voile bleu + texte blanc. Les
// couleurs sont en dur car la sidebar reste sombre quel que soit le thème.
export function InstructorNavItem({
  href,
  icon,
  children,
  exact,
}: InstructorNavItemProps) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border-l-[3px] px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-l-[#0EA5E9] bg-[#1E3A8A]/25 text-white"
          : "border-l-transparent text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#E2E8F0]",
      )}
    >
      <span
        className={cn(
          "shrink-0 transition-colors",
          active
            ? "text-[#0EA5E9]"
            : "text-[#64748B] group-hover:text-[#CBD5E1]",
        )}
      >
        {icon}
      </span>
      <span>{children}</span>
    </Link>
  );
}
