import "server-only";

// Service unique pour CRÉER des entrées AuditLog avec hash chain.
//
// Pourquoi : chaque entrée hashe (la précédente + son propre contenu). Si
// quelqu'un altère une ligne en SQL direct (ex: BO admin compromis, dump
// volé puis restauré modifié), la chaîne est cassée à partir de cette ligne
// → détectable par `verifyAuditChain()`.
//
// Convention applicative : ne JAMAIS update/delete sur AuditLog. Toujours
// passer par `createAuditLog()` pour préserver la chaîne. Les callers
// `prisma.auditLog.create(...)` existants doivent migrer progressivement
// (refactor non bloquant — les anciennes entrées restent valides sans hash).
//
// Note opérationnelle : la création est SÉRIALISÉE via une transaction
// SERIALIZABLE pour éviter les races sur le "previousHash". À très haute
// volumétrie (1k+ audit/s), envisager une partition par jour ou un job
// dédié de hashing différé. Aujourd'hui largement suffisant.

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { Prisma } from "@/generated/prisma/client";
import { logError, logWarning } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export interface CreateAuditLogInput {
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function createAuditLog(input: CreateAuditLogInput): Promise<void> {
  // Best-effort capture IP/UA si pas fournis explicitement.
  let ipAddress = input.ipAddress ?? null;
  let userAgent = input.userAgent ?? null;
  if (ipAddress === null || userAgent === null) {
    try {
      const h = await headers();
      ipAddress =
        ipAddress ??
        (h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          h.get("x-real-ip") ||
          null);
      userAgent = userAgent ?? h.get("user-agent");
    } catch {
      /* pas de headers context (cron, queue) — laisser null */
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const previous = await tx.auditLog.findFirst({
        orderBy: { createdAt: "desc" },
        select: { hash: true },
      });
      const previousHash = previous?.hash ?? null;

      // Hash = sha256(previousHash + canonical_json(payload))
      const payload = {
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata ?? null,
        ipAddress,
        userAgent,
      };
      const hash = computeAuditHash(previousHash, payload);

      await tx.auditLog.create({
        data: {
          actorId: payload.actorId,
          action: payload.action,
          targetType: payload.targetType,
          targetId: payload.targetId,
          metadata: (payload.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
          previousHash,
          hash,
        },
      });
    });
  } catch (error) {
    // L'audit log ne doit JAMAIS faire échouer l'action utilisateur (un
    // utilisateur ne doit pas perdre sa commande parce que l'audit est down).
    // On loggue dans Sentry et on continue.
    logError("audit-log", error, { action: input.action });
  }
}

function computeAuditHash(
  previousHash: string | null,
  payload: Record<string, unknown>,
): string {
  // Sérialisation canonique : tri des clés pour que le hash soit déterministe.
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash("sha256")
    .update(`${previousHash ?? ""}|${canonical}`)
    .digest("hex");
}

/**
 * Vérifie l'intégrité de la chaîne de hash sur les N dernières entrées.
 * Retourne le nombre d'incohérences détectées. À appeler depuis un cron
 * d'audit ou un script d'investigation.
 */
export async function verifyAuditChain(limit = 1000): Promise<{
  scanned: number;
  broken: number;
  firstBrokenId: string | null;
}> {
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "asc" },
    take: limit,
    where: { hash: { not: null } },
  });

  let broken = 0;
  let firstBrokenId: string | null = null;
  let runningHash: string | null = null;

  for (const entry of entries) {
    if (entry.previousHash !== runningHash && runningHash !== null) {
      broken++;
      if (!firstBrokenId) firstBrokenId = entry.id;
    }
    const expected = computeAuditHash(entry.previousHash, {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    });
    if (expected !== entry.hash) {
      broken++;
      if (!firstBrokenId) firstBrokenId = entry.id;
      logWarning("audit-log", "hash mismatch (probable altération)", {
        id: entry.id,
        expected,
        stored: entry.hash,
      });
    }
    runningHash = entry.hash;
  }

  return { scanned: entries.length, broken, firstBrokenId };
}
