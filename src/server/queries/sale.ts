import "server-only";

// Détecte une "solde active" sur le catalogue : au moins N cours avec un
// prix réduit ET un discountEndsAt dans le futur. Retourne la date de fin
// la plus PROCHE (= celle qui crée l'urgence à montrer dans le countdown).
//
// Utilisé par <CourseSaleBanner> sur les pages catalogue.

import { prisma } from "@/lib/prisma";

export interface ActiveSale {
  endsAt: Date;
  /** Nombre de cours actuellement en promo (= compte d'urgence). */
  coursesCount: number;
}

const MIN_COURSES_FOR_SALE_BANNER = 3;

export async function getActiveSale(): Promise<ActiveSale | null> {
  const now = new Date();
  const onSale = await prisma.course.findMany({
    where: {
      status: "PUBLISHED",
      discountPriceEUR: { not: null, lt: prisma.course.fields.priceEUR },
      discountEndsAt: { gt: now },
    },
    select: { discountEndsAt: true },
  });

  if (onSale.length < MIN_COURSES_FOR_SALE_BANNER) return null;

  // Date de fin la plus proche → maximise l'urgence du countdown.
  const endsAt = onSale
    .map((c) => c.discountEndsAt!)
    .reduce((earliest, d) => (d < earliest ? d : earliest));

  return { endsAt, coursesCount: onSale.length };
}
