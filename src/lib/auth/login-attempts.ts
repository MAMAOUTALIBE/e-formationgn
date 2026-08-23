import "server-only";

// Persiste un LoginAttempt (succès ou échec) dans la base, pour permettre
// l'affichage côté admin (/admin/securite/logs) et la détection d'abus.
// Best-effort : si l'écriture échoue, on log et on continue (la connexion
// utilisateur ne doit pas être bloquée par un souci d'audit).

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";

const HASH_SALT =
  process.env.RATE_LIMIT_IP_SALT ?? process.env.NEXTAUTH_SECRET ?? "ef-rl-salt";

function hashIp(ip: string): string {
  return createHash("sha256").update(`${HASH_SALT}:${ip}`).digest("hex").slice(0, 32);
}

export async function recordLoginAttempt(params: {
  email: string;
  userId?: string | null;
  success: boolean;
}): Promise<void> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const real = h.get("x-real-ip");
    const ip = (forwarded?.split(",")[0]?.trim() || real || "anonymous").slice(0, 64);
    const userAgent = h.get("user-agent")?.slice(0, 255) ?? null;

    await prisma.loginAttempt.create({
      data: {
        email: params.email.slice(0, 255),
        userId: params.userId ?? null,
        ipHash: hashIp(ip),
        userAgent,
        success: params.success,
      },
    });
  } catch (error) {
    console.warn("[login-attempts] persistence failed", error);
  }
}

// ---------------------------------------------------------------------------
// Account lockout — verrouille un email après N échecs récents
// ---------------------------------------------------------------------------

/** Nombre max d'échecs autorisés sur la fenêtre. */
export const ACCOUNT_LOCKOUT_THRESHOLD = 5;
/** Fenêtre d'observation (ms). */
export const ACCOUNT_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

export interface LockoutState {
  locked: boolean;
  /** Nombre d'échecs sur la fenêtre. */
  failures: number;
  /** Si verrouillé : timestamp où le verrou peut être levé (1er échec + 2× window). */
  unlockAt?: Date;
}

/**
 * Vérifie si un email est temporairement verrouillé suite à des échecs
 * consécutifs (en complément du rate-limit IP). Le compteur ne tient pas
 * compte des succès : un succès récent réinitialise effectivement la
 * fenêtre, car on regarde uniquement les échecs.
 *
 * Logique :
 *   - Compte les `LoginAttempt` success=false sur les 15 dernières minutes
 *   - Si ≥ 5 → locked. Le verrou se lève automatiquement quand le plus ancien
 *     échec sort de la fenêtre.
 */
export async function getEmailLockoutState(
  email: string,
): Promise<LockoutState> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { locked: false, failures: 0 };

  const since = new Date(Date.now() - ACCOUNT_LOCKOUT_WINDOW_MS);
  const failures = await prisma.loginAttempt.count({
    where: {
      email: trimmed,
      success: false,
      createdAt: { gte: since },
    },
  });

  if (failures < ACCOUNT_LOCKOUT_THRESHOLD) {
    return { locked: false, failures };
  }

  // On regarde le plus vieil échec dans la fenêtre pour calculer l'unlock
  const oldest = await prisma.loginAttempt.findFirst({
    where: {
      email: trimmed,
      success: false,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const unlockAt = oldest
    ? new Date(oldest.createdAt.getTime() + ACCOUNT_LOCKOUT_WINDOW_MS)
    : new Date(Date.now() + ACCOUNT_LOCKOUT_WINDOW_MS);

  return { locked: true, failures, unlockAt };
}

/**
 * Message affiché quand le verrou d'un compte est actif.
 *
 * Il ne dit PAS que le compte est verrouillé, et ne dit pas non plus « compte ».
 * Un verrou ne se déclenche que sur une adresse réellement inscrite : annoncer
 * le verrouillage revenait donc à confirmer l'existence du compte, et suffisait
 * à énumérer les inscrits en soumettant six mauvais mots de passe par adresse.
 * On reprend mot pour mot le message d'échec ordinaire, en y ajoutant seulement
 * le délai d'attente — sans quoi la personne réessaierait indéfiniment.
 */
export function lockoutMessage(unlockAt?: Date): string {
  const base = "Email ou mot de passe incorrect.";
  if (!unlockAt) return `${base} Réessayez plus tard.`;
  const seconds = Math.max(1, Math.ceil((unlockAt.getTime() - Date.now()) / 1000));
  if (seconds < 60) return `${base} Réessayez dans ${seconds} s.`;
  const minutes = Math.ceil(seconds / 60);
  return `${base} Réessayez dans ${minutes} min.`;
}
