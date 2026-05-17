// Shim de rétrocompat : les helpers de manipulation de montants vivent
// désormais dans `lib/payments/currency.ts` (module canonique multi-devises).
// Ce fichier ne reste que pour éviter de toucher ~30 import sites.
//
// Préférer les nouveaux noms `amountToMinor`/`minorToAmount`/`formatMinor`
// et le type `Money` (Readonly<{amount, currency}>) dans tout nouveau code.

import type { Currency } from "@/generated/prisma/enums";

import {
  amountToMinor,
  formatMinor,
  minorToAmount,
} from "@/lib/payments/currency";

export type { Money } from "@/lib/payments/currency";
export {
  money,
  moneyFromMinor,
  moneyToMinor,
  amountToMinor,
  minorToAmount,
  formatMinor,
} from "@/lib/payments/currency";

export type SupportedCurrency = "EUR" | "USD" | "GNF" | "XOF";

/** @deprecated Préférer `minorToAmount` (mêmes garanties). */
export function centsToAmount(cents: number, currency: Currency = "EUR"): number {
  return minorToAmount(cents, currency);
}

/** @deprecated Préférer `amountToMinor`. */
export function amountToCents(amount: number, currency: Currency = "EUR"): number {
  return amountToMinor(amount, currency);
}

/** @deprecated Préférer `formatMinor`. */
export function formatPriceFromCents(
  cents: number,
  currency: SupportedCurrency | Currency = "EUR",
): string {
  return formatMinor(cents, currency as Currency);
}

const CURRENCY_LOCALES: Record<SupportedCurrency, string> = {
  EUR: "fr-FR",
  USD: "en-US",
  GNF: "fr-GN",
  XOF: "fr-FR",
};

/**
 * Formate un montant déjà en unité d'affichage (€ humain) — distinct de
 * `formatMinor` qui prend une valeur en minor units. Utilise Intl.NumberFormat
 * avec le style "currency" (donc symbole localisé `€` / `$` / `FG` / `FCFA`).
 */
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
