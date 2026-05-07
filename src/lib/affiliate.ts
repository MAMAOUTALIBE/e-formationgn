// Helpers d'affiliation — lecture/écriture du cookie qui mémorise le code
// du formateur ayant amené le visiteur sur la plateforme.
//
// Au moment de l'achat, ce code est snapshotté sur l'Order, et on l'utilise
// pour décider du taux de commission (15 % vs 30 %) sur chaque OrderItem.

import { cookies } from "next/headers";

export const AFFILIATE_COOKIE = "efg_aff";
const COOKIE_TTL_DAYS = 30;

export async function readAffiliateCode(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(AFFILIATE_COOKIE)?.value;
  return value && value.length > 2 && value.length < 64 ? value : null;
}

export async function setAffiliateCode(code: string): Promise<void> {
  const store = await cookies();
  store.set({
    name: AFFILIATE_COOKIE,
    value: code,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearAffiliateCode(): Promise<void> {
  const store = await cookies();
  store.delete(AFFILIATE_COOKIE);
}
