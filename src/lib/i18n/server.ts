import "server-only";

// Lecture serveur de la locale active : cookie > Accept-Language > défaut.

import { cookies, headers } from "next/headers";

import {
  DEFAULT_LOCALE,
  isLocale,
  type Locale,
  getDictionary as getDictionaryRaw,
} from "@/lib/i18n/dictionaries";

export const LOCALE_COOKIE_NAME = "locale";

export async function readLocale(): Promise<Locale> {
  // 1) Cookie utilisateur (préférence explicite)
  try {
    const store = await cookies();
    const value = store.get(LOCALE_COOKIE_NAME)?.value;
    if (isLocale(value)) return value;
  } catch {
    /* cookies() peut throw dans certains contextes */
  }

  // 2) Accept-Language (best effort, on prend la première langue supportée)
  try {
    const h = await headers();
    const acceptLang = h.get("accept-language");
    if (acceptLang) {
      const first = acceptLang.split(",")[0]?.split("-")[0]?.trim().toLowerCase();
      if (isLocale(first)) return first;
    }
  } catch {
    /* idem */
  }

  return DEFAULT_LOCALE;
}

export async function getDictionary() {
  const locale = await readLocale();
  return { locale, t: getDictionaryRaw(locale) };
}
