// Helpers de manipulation des montants. Convention : tous les montants sont
// stockés en cents (entiers) côté serveur (compatible Stripe). On ne convertit
// en flottants qu'à l'affichage.

import type { Currency } from "@/generated/prisma/enums";

export type SupportedCurrency = "EUR" | "USD";

export function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

export function amountToCents(amount: number): number {
  return Math.round(amount * 100);
}

const CURRENCY_LOCALES: Record<SupportedCurrency, string> = {
  EUR: "fr-FR",
  USD: "en-US",
};

export function formatPriceFromCents(
  cents: number,
  currency: SupportedCurrency | Currency = "EUR",
): string {
  return new Intl.NumberFormat(CURRENCY_LOCALES[currency as SupportedCurrency], {
    style: "currency",
    currency: currency as string,
    minimumFractionDigits: 2,
  }).format(centsToAmount(cents));
}

export function formatPrice(
  amount: number,
  currency: SupportedCurrency = "EUR",
): string {
  return new Intl.NumberFormat(CURRENCY_LOCALES[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
