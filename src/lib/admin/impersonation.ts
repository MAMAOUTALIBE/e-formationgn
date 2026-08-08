// Le cookie d'impersonation est un pointeur opaque vers le registre serveur.
// Il ne contient jamais l'identité de la cible : admin, cible et validité sont
// systématiquement relus depuis ImpersonationSession avant utilisation.

import { cookies } from "next/headers";

const COOKIE_NAME = "admin_impersonation";
export const IMPERSONATION_MAX_AGE_MS = 4 * 60 * 60 * 1000;

interface ImpersonationCookie {
  sessionId: string;
}

export async function readImpersonation(): Promise<ImpersonationCookie | null> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value.trim();
  if (!sessionId || sessionId.length > 191) return null;
  return { sessionId };
}

export async function writeImpersonation(value: ImpersonationCookie): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, value.sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: IMPERSONATION_MAX_AGE_MS / 1000,
  });
}

export async function clearImpersonation(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
