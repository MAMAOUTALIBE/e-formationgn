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
