import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

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
}: KpiCardProps) {
  const formattedValue =
    typeof value === "number" ? numberFormatter.format(value) : value;

  const Wrapper = href ? "a" : "div";

  return (
    <Wrapper
      {...(href ? { href } : {})}
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow",
        href &&
          "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            TONE_CLASS[tone],
          )}
        >
          {icon}
        </span>
      ) : null}

      {/* `min-w-0` : sans lui, un libellé long élargirait la carte au lieu
          d'être tronqué, et la grille de KPI déborderait. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3 overflow-hidden">
          <div className="min-w-0">
            {/* Le chiffre prime : il ne se coupe jamais (`whitespace-nowrap`),
                sinon « 0,00 € » se scinde entre le nombre et le symbole dès
                que le CRM passe aux grandes échelles de texte. */}
            <p className="whitespace-nowrap text-2xl font-semibold tracking-tight text-foreground">
              {formattedValue}
            </p>
            <p className="truncate text-sm font-medium text-muted-foreground">
              {label}
            </p>
          </div>
          {sparkline ? (
            <div className="h-10 w-20 min-w-0 shrink text-muted-foreground">
              {sparkline}
            </div>
          ) : null}
        </div>

        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}

        {delta !== null && delta !== undefined ? <DeltaBadge delta={delta} /> : null}
      </div>
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
