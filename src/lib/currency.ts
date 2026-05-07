// Devise active de l'utilisateur, lue dans cet ordre :
//   1. cookie `efg_currency` si présent (toggle utilisateur)
//   2. session.user.preferredCurrency si connecté
//   3. EUR par défaut
//
// L'écriture (toggle) se fait via une Server Action (cf. setCurrency).

import { cookies } from "next/headers";

import type { Currency } from "@/generated/prisma/enums";

export const CURRENCY_COOKIE = "efg_currency";

const SUPPORTED: Currency[] = ["EUR", "USD"];

export async function readCurrencyCookie(): Promise<Currency | null> {
  const store = await cookies();
  const value = store.get(CURRENCY_COOKIE)?.value as Currency | undefined;
  return value && (SUPPORTED as string[]).includes(value) ? value : null;
}

export async function writeCurrencyCookie(currency: Currency): Promise<void> {
  const store = await cookies();
  store.set({
    name: CURRENCY_COOKIE,
    value: currency,
    httpOnly: false, // lisible côté client pour l'UI immédiate
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
}

export async function getCurrentCurrency(
  fallback: Currency = "EUR",
): Promise<Currency> {
  return (await readCurrencyCookie()) ?? fallback;
}
