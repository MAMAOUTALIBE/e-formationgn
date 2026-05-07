import "server-only";

// Lecture serveur-only de la période active : searchParam > cookie > défaut.

import { cookies } from "next/headers";

import {
  PERIOD_COOKIE_NAME,
  parsePeriodParam,
  type PeriodValue,
} from "@/lib/admin/period";

export async function readPeriod(searchParam?: string | null): Promise<PeriodValue> {
  if (searchParam) return parsePeriodParam(searchParam);
  try {
    const store = await cookies();
    const cookieValue = store.get(PERIOD_COOKIE_NAME)?.value;
    if (cookieValue) return parsePeriodParam(cookieValue);
  } catch {
    /* cookies() may throw in some contexts */
  }
  return { preset: "30d" };
}
