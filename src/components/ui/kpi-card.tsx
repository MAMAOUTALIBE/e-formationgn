import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  /** Variation par rapport à la période précédente (en pourcentage signé). */
  delta?: number | null;
  /** Sous-titre / unité (ex: "ce mois", "EUR"). */
  hint?: string;
  /** Icône Lucide à afficher en pastille. */
  icon?: React.ReactNode;
  /** Sparkline (composant Recharts pré-rendu). */
  sparkline?: React.ReactNode;
  className?: string;
  /** Si fourni, la carte devient cliquable (lien). */
  href?: string;
}

const numberFormatter = new Intl.NumberFormat("fr-FR");

export function KpiCard({
  label,
  value,
  delta,
  hint,
  icon,
  sparkline,
  className,
  href,
}: KpiCardProps) {
  const formattedValue =
    typeof value === "number" ? numberFormatter.format(value) : value;

  const Wrapper = href ? "a" : "div";

  return (
    <Wrapper
      {...(href ? { href } : {})}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow",
        href && "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon ? (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {icon}
          </span>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {formattedValue}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        {sparkline ? (
          <div className="h-10 w-24 shrink-0 text-muted-foreground">
            {sparkline}
          </div>
        ) : null}
      </div>

      {delta !== null && delta !== undefined ? (
        <DeltaBadge delta={delta} />
      ) : null}
    </Wrapper>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  const isUp = delta > 0;
  const isDown = delta < 0;
  const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
  const tone = isUp
    ? "text-[color:var(--brand-success)] bg-[color:var(--brand-success)]/10"
    : isDown
      ? "text-red-700 bg-red-500/10 dark:text-red-400"
      : "text-muted-foreground bg-muted";
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tone,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {delta > 0 ? "+" : ""}
      {delta.toFixed(1)} %
      <span className="text-muted-foreground/80">vs période préc.</span>
    </span>
  );
}
