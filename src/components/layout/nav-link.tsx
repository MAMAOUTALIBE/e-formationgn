"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  /** Quand true, l'item est actif si le pathname commence par href (vs. égalité stricte). */
  matchPrefix?: boolean;
}

export function NavLink({
  href,
  children,
  className,
  matchPrefix = true,
}: NavLinkProps) {
  const pathname = usePathname();
  const isActive = matchPrefix
    ? pathname === href || pathname.startsWith(`${href}/`)
    : pathname === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold shadow-[0_3px_12px_rgba(15,23,42,0.05)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
        isActive
          ? "border-emerald-200 bg-emerald-50 text-[color:var(--brand-primary)]"
          : "border-slate-200/80 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50 hover:text-[color:var(--brand-primary)]",
        className,
      )}
    >
      {children}
    </Link>
  );
}
