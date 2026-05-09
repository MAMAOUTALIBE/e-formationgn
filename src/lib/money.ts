// Helpers de manipulation des montants.
//
// Convention : montants stockés en « minor units » (entiers) côté serveur.
// EUR / USD : centimes. GNF / XOF : pas de subdivision (1 GNF = 1 unité).
// On ne convertit en flottants qu'à l'affichage.
//
// Module historique conservé pour rétrocompat (formatPriceFromCents). Les
// nouveaux flux paiements (CinetPay) utilisent `lib/payments/currency.ts`
// qui gère natif les 4 devises.

import type { Currency } from "@/generated/prisma/enums";

export type SupportedCurrency = "EUR" | "USD" | "GNF" | "XOF";

export function centsToAmount(cents: number, currency: Currency = "EUR"): number {
  // EUR / USD = centimes. GNF / XOF = unités entières.
  const divisor = currency === "GNF" || currency === "XOF" ? 1 : 100;
  return cents / divisor;
}

export function amountToCents(amount: number, currency: Currency = "EUR"): number {
  const multiplier = currency === "GNF" || currency === "XOF" ? 1 : 100;
  return Math.round(amount * multiplier);
}

const CURRENCY_LOCALES: Record<SupportedCurrency, string> = {
  EUR: "fr-FR",
  USD: "en-US",
  GNF: "fr-GN",
  XOF: "fr-FR",
};

export function formatPriceFromCents(
  cents: number,
  currency: SupportedCurrency | Currency = "EUR",
): string {
  const isWholeUnitCurrency = currency === "GNF" || currency === "XOF";
  const fractionDigits = isWholeUnitCurrency ? 0 : 2;
  const locale = CURRENCY_LOCALES[currency as SupportedCurrency] ?? "fr-FR";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency as string,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(centsToAmount(cents, currency as Currency));
}

export function formatPrice(
  amount: number,
  currency: SupportedCurrency = "EUR",
): string {
  const isWholeUnitCurrency = currency === "GNF" || currency === "XOF";
  const fractionDigits = isWholeUnitCurrency ? 0 : 2;
  return new Intl.NumberFormat(CURRENCY_LOCALES[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}
