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
      className={cn(
        "relative text-sm font-medium transition-colors",
        isActive
          ? "text-[color:var(--brand-violet-deep)]"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
      {isActive ? (
        <span
          aria-hidden
          className="absolute inset-x-0 -bottom-[22px] mx-auto h-0.5 w-full rounded-full bg-gradient-to-r from-[color:var(--brand-violet)] to-[color:var(--brand-mint)]"
        />
      ) : null}
    </Link>
  );
}
