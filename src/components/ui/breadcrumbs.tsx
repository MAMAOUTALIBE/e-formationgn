import Link from "next/link";
import { ChevronRight } from "lucide-react";
import * as React from "react";

import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbListJsonLd } from "@/lib/seo/json-ld";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  // Désactive l'émission du JSON-LD BreadcrumbList (utile si la page contient
  // plusieurs Breadcrumbs ou si le JSON-LD est déjà rendu par ailleurs).
  noJsonLd?: boolean;
}

export function Breadcrumbs({ items, className, noJsonLd }: BreadcrumbsProps) {
  // Identifiant déterministe : hash des labels — évite les collisions si la
  // page rend plusieurs Breadcrumbs (par ex. dans un drawer).
  const jsonLdId = `breadcrumb-${items.map((i) => i.label.replace(/\s+/g, "-")).join("_").slice(0, 80)}`;
  return (
    <>
      {!noJsonLd && items.length > 1 ? (
        <JsonLd id={jsonLdId} data={buildBreadcrumbListJsonLd(items)} />
      ) : null}
      <nav aria-label="Fil d'Ariane" className={cn("text-sm", className)}>
        <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={`${item.label}-${index}`} className="flex items-center gap-1">
                {item.href && !isLast ? (
                  <Link href={item.href} className="hover:text-foreground">
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={isLast ? "page" : undefined} className={isLast ? "text-foreground font-medium" : undefined}>
                    {item.label}
                  </span>
                )}
                {!isLast ? (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
