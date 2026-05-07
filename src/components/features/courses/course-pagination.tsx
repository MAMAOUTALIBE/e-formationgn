import Link from "next/link";

import { cn } from "@/lib/utils";

interface CoursePaginationProps {
  currentPage: number;
  pageCount: number;
  searchParams: Record<string, string | string[] | undefined>;
  basePath: string;
}

function buildHref(
  basePath: string,
  searchParams: Record<string, string | string[] | undefined>,
  page: number,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && value.length > 0) next.set(key, value);
    else if (Array.isArray(value) && value.length > 0) next.set(key, value[0]);
  }
  if (page > 1) next.set("page", String(page));
  else next.delete("page");
  const qs = next.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function CoursePagination({
  currentPage,
  pageCount,
  searchParams,
  basePath,
}: CoursePaginationProps) {
  if (pageCount <= 1) return null;

  // Logique simple : on affiche prev / 1 / … / current-1 / current / current+1 / … / last / next
  const pages = new Set<number>([1, pageCount, currentPage]);
  for (let i = currentPage - 1; i <= currentPage + 1; i++) {
    if (i >= 1 && i <= pageCount) pages.add(i);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      <PageLink
        href={buildHref(basePath, searchParams, Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        label="Précédent"
        srLabel="Page précédente"
      />

      <ul className="flex items-center gap-1">
        {sorted.map((page, index) => {
          const previous = sorted[index - 1];
          const showEllipsis = previous !== undefined && page - previous > 1;
          return (
            <li key={page} className="flex items-center gap-1">
              {showEllipsis ? (
                <span aria-hidden className="px-2 text-sm text-muted-foreground">
                  …
                </span>
              ) : null}
              <Link
                href={buildHref(basePath, searchParams, page)}
                aria-current={page === currentPage ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-border px-3 text-sm transition-colors",
                  page === currentPage
                    ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] text-primary-foreground"
                    : "bg-card text-foreground hover:bg-muted",
                )}
              >
                {page}
              </Link>
            </li>
          );
        })}
      </ul>

      <PageLink
        href={buildHref(basePath, searchParams, Math.min(pageCount, currentPage + 1))}
        disabled={currentPage === pageCount}
        label="Suivant"
        srLabel="Page suivante"
      />
    </nav>
  );
}

interface PageLinkProps {
  href: string;
  disabled: boolean;
  label: string;
  srLabel: string;
}

function PageLink({ href, disabled, label, srLabel }: PageLinkProps) {
  if (disabled) {
    return (
      <span
        aria-disabled
        className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground/60"
      >
        <span className="hidden sm:inline">{label}</span>
        <span className="sr-only">{srLabel}</span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-3 text-sm text-foreground transition-colors hover:bg-muted"
    >
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only">{srLabel}</span>
    </Link>
  );
}
