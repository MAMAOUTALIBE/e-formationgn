// Helpers multi-devises — module **canonique** pour tout ce qui touche aux
// montants. Le code stocke les montants en "minor units" (Order.totalCents).
// Pour EUR / USD c'est des centimes (×100). Pour GNF / XOF, ces devises
// n'ont PAS de subdivision : 1 GNF = 1 unité, on stocke directement la
// valeur entière. Ce module centralise les conversions pour éviter les
// bugs d'arrondi croisés.
//
// Le type `Money` (readonly amount + currency) permet de passer un montant
// typé d'une couche à l'autre sans risquer de mélanger les devises.
// L'ancien `lib/money.ts` re-exporte les helpers d'ici pour rétrocompat.

import type { Currency } from "@/generated/prisma/enums";

/**
 * Représentation immuable d'un montant monétaire. À privilégier dans toute
 * nouvelle signature de fonction qui prend ou retourne un prix : un seul
 * paramètre au lieu de deux, le compilateur évite l'inversion.
 */
export type Money = Readonly<{ amount: number; currency: Currency }>;

/** Construit une instance Money — protège contre NaN et arrondit à l'ulité. */
export function money(amount: number, currency: Currency): Money {
  if (!Number.isFinite(amount)) {
    throw new TypeError(`Money: amount doit être un nombre fini (reçu ${amount})`);
  }
  return Object.freeze({ amount, currency });
}

/** Construit un Money depuis une valeur en minor units. */
export function moneyFromMinor(minor: number, currency: Currency): Money {
  return money(minorToAmount(minor, currency), currency);
}

/** Retourne la valeur d'un Money en minor units. */
export function moneyToMinor(value: Money): number {
  return amountToMinor(value.amount, value.currency);
}

/**
 * Multiplicateur entre une valeur en unité « affichage » (1 €, 5 GNF) et
 * la valeur stockée en `totalCents` côté DB.
 *   EUR / USD : 100 (centimes)
 *   GNF / XOF : 1   (pas de subdivision)
 */
export function currencyMinorMultiplier(currency: Currency): number {
  switch (currency) {
    case "EUR":
    case "USD":
      return 100;
    case "GNF":
    case "XOF":
      return 1;
  }
}

/** Convertit un montant en unité affichable (€ humain) → minor units (cents). */
export function amountToMinor(amount: number, currency: Currency): number {
  const m = currencyMinorMultiplier(currency);
  // Math.round pour éviter les bugs binaires (ex: 19.99 * 100 = 1998.999...)
  return Math.round(Number(amount) * m);
}

/** Convertit minor units (cents) → unité affichable. */
export function minorToAmount(minor: number, currency: Currency): number {
  const m = currencyMinorMultiplier(currency);
  return minor / m;
}

/**
 * Liste des devises gérées par chaque PSP.
 *
 * Stripe Checkout supporte EUR / USD (et bien d'autres, mais on ne diffuse
 * pas GNF / XOF via Stripe — ces devises ne sont pas dans leur liste).
 *
 * CinetPay supporte XOF, XAF, CDF, GNF, USD, EUR — on garde celles
 * pertinentes pour notre marché.
 */
export const STRIPE_CURRENCIES = ["EUR", "USD"] as const satisfies readonly Currency[];
export const CINETPAY_CURRENCIES = ["EUR", "USD", "GNF", "XOF"] as const satisfies readonly Currency[];

export function isStripeSupported(currency: Currency): boolean {
  return (STRIPE_CURRENCIES as readonly string[]).includes(currency);
}

export function isCinetPaySupported(currency: Currency): boolean {
  return (CINETPAY_CURRENCIES as readonly string[]).includes(currency);
}

/** Symbole compact pour affichage UI. */
export function currencySymbol(currency: Currency): string {
  switch (currency) {
    case "EUR":
      return "€";
    case "USD":
      return "$";
    case "GNF":
      return "FG";
    case "XOF":
      return "FCFA";
  }
}

/**
 * Formate un montant minor unit → string utilisateur, locale fr-FR.
 * GNF / XOF : pas de décimales. EUR / USD : 2 décimales.
 */
export function formatMinor(minor: number, currency: Currency): string {
  const value = minorToAmount(minor, currency);
  const fractionDigits = currency === "GNF" || currency === "XOF" ? 0 : 2;
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
  return `${formatted} ${currencySymbol(currency)}`;
}
