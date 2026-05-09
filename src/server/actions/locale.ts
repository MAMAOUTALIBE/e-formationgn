"use server";

// Server Action : enregistre la préférence de langue dans un cookie.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { isLocale } from "@/lib/i18n/dictionaries";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/server";

export async function setLocale(value: string): Promise<{ ok: boolean }> {
  if (!isLocale(value)) return { ok: false };
  const store = await cookies();
  store.set({
    name: LOCALE_COOKIE_NAME,
    value,
    httpOnly: false, // lisible côté client pour synchro éventuelle
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 60 * 60, // 1 an
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
