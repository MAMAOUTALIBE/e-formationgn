import { TrendingDown, TrendingUp } from "lucide-react";

interface SalesTrendProps {
  series: Array<{ label: string; count: number }>;
  thisMonth: number;
  prevMonth: number;
}

/**
 * Mini-graphe en barres (6 mois) des ventes + delta vs mois précédent.
 * SVG pur, aucune librairie de charts — léger et rendu côté serveur.
 */
export function SalesTrend({ series, thisMonth, prevMonth }: SalesTrendProps) {
  const delta = thisMonth - prevMonth;
  const pct =
    prevMonth > 0
      ? Math.round((delta / prevMonth) * 100)
      : thisMonth > 0
        ? 100
        : 0;
  const up = delta >= 0;
  const max = Math.max(1, ...series.map((s) => s.count));

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-end gap-1" aria-hidden>
        {series.map((s, i) => {
          const isCurrent = i === series.length - 1;
          const h = Math.max(4, Math.round((s.count / max) * 40));
          return (
            <div
              key={s.label + i}
              className="flex flex-col items-center gap-1"
              title={`${s.label} : ${s.count}`}
            >
              <div
                className="w-4 rounded-sm"
                style={{
                  height: `${h}px`,
                  backgroundColor: isCurrent
                    ? "var(--brand-primary)"
                    : "var(--muted-foreground, #94a3b8)",
                  opacity: isCurrent ? 1 : 0.35,
                }}
              />
              <span className="text-[10px] capitalize text-muted-foreground">
                {s.label.replace(".", "")}
              </span>
            </div>
          );
        })}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Ventes ce mois
        </p>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {thisMonth}
          </span>
          <span
            className={
              "inline-flex items-center gap-1 text-xs font-medium " +
              (up
                ? "text-[color:var(--brand-success)]"
                : "text-[color:var(--brand-danger)]")
            }
          >
            {up ? (
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" aria-hidden />
            )}
            {up ? "+" : ""}
            {pct}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          vs {prevMonth} le mois dernier
        </p>
      </div>
    </div>
  );
}
