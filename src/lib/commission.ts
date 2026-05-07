// Calcul de la commission de la plateforme.
// - Vente initiée par le formateur (lien d'affiliation, audience perso) : 15%
// - Vente initiée par la plateforme (recherche, recommandations, marketing) : 30%
//
// Les taux par défaut sont configurables via env (PLATFORM_COMMISSION_*_BPS) et
// surchargés en base via la table CommissionRate (modifiable par l'admin).

import type { CommissionSource } from "@/generated/prisma/enums";

export const DEFAULT_COMMISSION_RATES = {
  INSTRUCTOR_DRIVEN: 1500, // 15% en bps
  PLATFORM_DRIVEN: 3000, // 30% en bps
} as const satisfies Record<CommissionSource, number>;

export interface CommissionBreakdown {
  rateBps: number;
  platformFeeCents: number;
  instructorPayoutCents: number;
  source: CommissionSource;
}

export function computeCommission(
  totalCents: number,
  source: CommissionSource,
  rateBps: number = DEFAULT_COMMISSION_RATES[source],
): CommissionBreakdown {
  const platformFeeCents = Math.round((totalCents * rateBps) / 10_000);
  const instructorPayoutCents = totalCents - platformFeeCents;
  return { rateBps, platformFeeCents, instructorPayoutCents, source };
}
