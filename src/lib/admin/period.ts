// Helpers de période — pure data, importable depuis client ET server.
// Pas d'imports `next/headers` ici (sinon le client crashe).
// La lecture du cookie `admin_period` est isolée dans period-server.ts.

export type PeriodPreset = "today" | "7d" | "30d" | "90d" | "12m" | "custom";

export const PERIOD_COOKIE_NAME = "admin_period";

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

/** Une période choisie reste valable un mois d'une visite à l'autre. */
const PERIOD_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * Mémorise la période choisie pour les autres écrans du CRM.
 *
 * Défini hors composant : le compilateur React interdit d'écrire sur une
 * valeur extérieure (`document`) depuis le corps d'un composant.
 */
export function persistPeriodCookie(serialized: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${PERIOD_COOKIE_NAME}=${encodeURIComponent(serialized)}; Path=/; Max-Age=${PERIOD_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  today: "Aujourd'hui",
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
  "90d": "90 derniers jours",
  "12m": "12 derniers mois",
  custom: "Personnalisé",
};
