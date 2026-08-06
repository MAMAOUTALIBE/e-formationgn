"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { findAdminSection } from "@/lib/admin/navigation";

/**
 * Barre de sous-navigation de la section admin courante.
 *
 * Avant, l'admin n'avait qu'un seul layout : arrivé sur
 * /admin/finances/payouts, rien n'indiquait l'existence des pages sœurs
 * (transactions, remboursements, rapports) — on y revenait au bouton retour.
 *
 * Ne rend rien si la section n'a pas de sous-pages : inutile d'occuper une
 * bande de hauteur sur /admin ou /admin/utilisateurs, d'autant que la
 * coquille du layout est à hauteur de viewport fixe.
 */
export function AdminSectionNav() {
  const pathname = usePathname();
  const section = findAdminSection(pathname);

  if (!section || section.children.length === 0) return null;

  const items = [{ href: section.href, label: "Vue d'ensemble" }, ...section.children];

  return (
    <nav
      aria-label={`Navigation ${section.label}`}
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-background px-4 lg:px-6"
    >
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors",
              active
                ? "border-[color:var(--brand-primary)] font-medium text-[color:var(--brand-primary)]"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
