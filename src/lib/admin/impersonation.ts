// Helpers cookie pour le mode impersonation admin.
// Le cookie est lu côté serveur uniquement (HttpOnly).
// La logique de swap effective dans `auth()` est ajoutée par le module
// Sécurité (Phase 5) — ici on stocke uniquement l'état pour afficher la
// bannière et désactiver le mode.

import { cookies } from "next/headers";

const COOKIE_NAME = "admin_impersonation";

interface ImpersonationCookie {
  sessionId: string;
  targetUserId: string;
}

export async function readImpersonation(): Promise<ImpersonationCookie | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImpersonationCookie;
  } catch {
    return null;
  }
}

export async function writeImpersonation(value: ImpersonationCookie): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4, // 4 heures
  });
}

export async function clearImpersonation(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
