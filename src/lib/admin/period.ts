// Helpers de période partagés entre Server Components et Client Components.
// Volontairement isolés du composant client `<DateRangePicker>` pour qu'un
// Server Component puisse appeler `parsePeriodParam` / `periodToRange` sans
// franchir la frontière client/serveur.

export type PeriodPreset = "today" | "7d" | "30d" | "90d" | "12m" | "custom";

export interface PeriodValue {
  preset: PeriodPreset;
  from?: string; // ISO date YYYY-MM-DD (uniquement si preset === custom)
  to?: string;
}

export function periodToRange(period: PeriodValue): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  let from = new Date(now);
  switch (period.preset) {
    case "today":
      from.setHours(0, 0, 0, 0);
      break;
    case "7d":
      from.setDate(from.getDate() - 7);
      break;
    case "30d":
      from.setDate(from.getDate() - 30);
      break;
    case "90d":
      from.setDate(from.getDate() - 90);
      break;
    case "12m":
      from.setMonth(from.getMonth() - 12);
      break;
    case "custom":
      if (period.from) from = new Date(period.from);
      if (period.to) to.setTime(new Date(period.to).getTime());
      break;
  }
  return { from, to };
}

export function parsePeriodParam(value: string | null): PeriodValue {
  if (!value) return { preset: "30d" };
  const [preset, from, to] = value.split("|") as [PeriodPreset, string?, string?];
  return { preset, from, to };
}

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  today: "Aujourd'hui",
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
  "90d": "90 derniers jours",
  "12m": "12 derniers mois",
  custom: "Personnalisé",
};
