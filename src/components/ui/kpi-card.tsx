import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ArrowUpRightIcon, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Teinte de la pastille d'icône.
 *
 * La couleur ne code aucune information — elle sert à distinguer les cartes
 * d'une rangée d'un coup d'œil, pour qu'on retrouve « sa » carte par sa
 * position ET sa couleur plutôt qu'en relisant les libellés. Le violet est
 * volontairement absent : la charte le réserve à la landing publique.
 */
export type KpiTone = "slate" | "blue" | "sky" | "emerald" | "amber" | "rose";

const TONE_CLASS: Record<KpiTone, string> = {
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
};

const ACCENT_CLASS: Record<KpiTone, string> = {
  slate: "from-slate-500/70 via-slate-400/20",
  blue: "from-blue-600/80 via-blue-400/20",
  sky: "from-sky-500/80 via-sky-400/20",
  emerald: "from-emerald-500/80 via-emerald-400/20",
  amber: "from-amber-500/80 via-amber-400/20",
  rose: "from-rose-500/80 via-rose-400/20",
};

interface KpiCardProps {
  label: string;
  value: string | number;
  /** Variation par rapport à la période précédente (en pourcentage signé). */
  delta?: number | null;
  /** Sous-titre / unité (ex: "ce mois", "EUR"). */
  hint?: string;
  /** Icône Lucide à afficher en pastille. */
  icon?: React.ReactNode;
  /** Teinte de la pastille d'icône (décorative). */
  tone?: KpiTone;
  /** Sparkline (composant Recharts pré-rendu). */
  sparkline?: React.ReactNode;
  className?: string;
  /** Si fourni, la carte devient cliquable (lien). */
  href?: string;
  /** Mise en avant pour un indicateur stratégique du tableau de bord. */
  featured?: boolean;
  /** Disposition CRM : libellé et valeur à gauche, icône en haut à droite. */
  appearance?: "default" | "crm";
}

const numberFormatter = new Intl.NumberFormat("fr-FR");

export function KpiCard({
  label,
  value,
  delta,
  hint,
  icon,
  tone = "slate",
  sparkline,
  className,
  href,
  featured = false,
  appearance = "default",
}: KpiCardProps) {
  const formattedValue =
    typeof value === "number" ? numberFormatter.format(value) : value;

  const content = (
    <>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent",
          ACCENT_CLASS[tone],
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon && appearance !== "crm" ? (
            <span
              aria-hidden
              className={cn(
                "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-inset ring-white/40 transition-transform duration-200 group-hover:-translate-y-0.5",
                TONE_CLASS[tone],
              )}
            >
              {icon}
            </span>
          ) : null}

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {label}
            </p>
            <p
              className={cn(
                "mt-1 whitespace-nowrap font-semibold tracking-[-0.035em] text-foreground",
                featured ? "text-3xl" : "text-2xl",
              )}
            >
              {formattedValue}
            </p>
          </div>
        </div>

        {icon && appearance === "crm" ? (
          <span
            aria-hidden
            className={cn(
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-inset ring-white/40",
              TONE_CLASS[tone],
            )}
          >
            {icon}
          </span>
        ) : null}

        {href && appearance !== "crm" ? (
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground transition group-hover:border-foreground/20 group-hover:text-foreground">
            <ArrowUpRightIcon className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : null}
      </div>

      <div className="mt-auto pt-3">
        {sparkline ? (
          <div className="mb-2 h-9 w-full text-muted-foreground">{sparkline}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {delta !== null && delta !== undefined ? <DeltaBadge delta={delta} /> : null}
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
    </>
  );

  const classes = cn(
    "group relative flex min-h-36 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] transition duration-200",
    appearance === "crm" && "min-h-32",
    href &&
      "hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_12px_32px_rgba(15,23,42,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    featured && "min-h-40 bg-gradient-to-br from-card via-card to-muted/50",
    className,
  );

  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <div className={classes}>
      {content}
    </div>
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
