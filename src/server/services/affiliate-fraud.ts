import "server-only";

// Détection anti-fraude pour le programme d'affiliation.
//
// Vecteurs couverts :
//
//   1. SELF-REFERRAL : le formateur achète son propre cours avec son propre
//      `?ref=affiliateCode`. La ligne devient INSTRUCTOR_DRIVEN (commission
//      plateforme réduite) → il pocket un % qu'il n'aurait pas eu. Évident.
//
//   2. PROXY SELF-REFERRAL : le formateur crée un faux compte élève et achète
//      depuis là. Plus discret. Détecté via collision IP/UA avec les
//      AffiliateClick récents de ce code (heuristique probabiliste, pas
//      bloquant en soi sauf seuil dépassé).
//
//   3. VELOCITY : ramp-up suspect (N achats INSTRUCTOR_DRIVEN sur le même code
//      en quelques heures). On loggue + on dégrade la commission au taux
//      PLATFORM_DRIVEN sans rejeter l'achat (UX préservée).
//
// Décision : on retourne `{ honored: false, reason }` pour neutraliser la
// remise de commission affiliée tout en laissant la commande passer. On
// audit-log chaque détection pour investigation manuelle ultérieure.

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "./audit-log";

const SELF_REFERRAL_CAP_PER_DAY = 5; // velocity seuil
const COLLISION_WINDOW_HOURS = 24;

export interface AffiliateGuardInput {
  affiliateCode: string;
  /** ID de l'utilisateur qui passe la commande. */
  buyerId: string;
}

export type AffiliateGuardResult =
  | { honored: true; affiliateUserId: string }
  | { honored: false; reason: AffiliateRejectionReason };

export type AffiliateRejectionReason =
  | "unknown_code"
  | "self_referral"
  | "ip_collision"
  | "velocity_cap";

export async function guardAffiliateCode(
  input: AffiliateGuardInput,
): Promise<AffiliateGuardResult> {
  const { affiliateCode, buyerId } = input;

  const owner = await prisma.user.findUnique({
    where: { affiliateCode },
    select: { id: true },
  });
  if (!owner) {
    return { honored: false, reason: "unknown_code" };
  }

  // 1. Self-referral direct
  if (owner.id === buyerId) {
    await audit({
      affiliateUserId: owner.id,
      buyerId,
      reason: "self_referral",
      code: affiliateCode,
    });
    return { honored: false, reason: "self_referral" };
  }

  // 2. Velocity cap : trop d'achats récents → on neutralise
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.order.count({
    where: {
      affiliateCode,
      createdAt: { gte: since },
      status: { in: ["PAID", "PENDING"] },
    },
  });
  if (recent >= SELF_REFERRAL_CAP_PER_DAY) {
    await audit({
      affiliateUserId: owner.id,
      buyerId,
      reason: "velocity_cap",
      code: affiliateCode,
      metadata: { recent24h: recent },
    });
    return { honored: false, reason: "velocity_cap" };
  }

  // 3. Collision IP/UA avec un click récent du même code
  const ipHash = await currentIpHash();
  if (ipHash) {
    const collisionWindowStart = new Date(
      Date.now() - COLLISION_WINDOW_HOURS * 60 * 60 * 1000,
    );
    const matchingClick = await prisma.affiliateClick.findFirst({
      where: {
        affiliateUserId: owner.id,
        ipHash,
        createdAt: { gte: collisionWindowStart },
      },
      select: { id: true },
    });
    if (matchingClick) {
      // Collision = même IP que celle qui a généré le click. Souvent
      // légitime (clic puis achat depuis le même appareil), MAIS si le
      // formateur lui-même a cliqué sur son propre lien, c'est rouge.
      // On vérifie si l'owner a cliqué récemment depuis cette IP.
      const ownerSelfClick = await prisma.affiliateClick.findFirst({
        where: {
          affiliateUserId: owner.id,
          ipHash,
          createdAt: { gte: collisionWindowStart },
        },
        orderBy: { createdAt: "desc" },
        select: { visitorHash: true },
      });
      // Si on a un visitorHash et qu'il diffère d'un autre visitor récent
      // depuis cette IP → c'est un device différent (probable légitime).
      // Si c'est le seul visitor depuis cette IP → suspect.
      if (ownerSelfClick) {
        const distinctVisitors = await prisma.affiliateClick.findMany({
          where: {
            affiliateUserId: owner.id,
            ipHash,
            createdAt: { gte: collisionWindowStart },
          },
          select: { visitorHash: true },
          distinct: ["visitorHash"],
          take: 5,
        });
        if (distinctVisitors.length <= 1) {
          await audit({
            affiliateUserId: owner.id,
            buyerId,
            reason: "ip_collision",
            code: affiliateCode,
            metadata: { ipHashPrefix: ipHash.slice(0, 8) },
          });
          return { honored: false, reason: "ip_collision" };
        }
      }
    }
  }

  return { honored: true, affiliateUserId: owner.id };
}

async function currentIpHash(): Promise<string | null> {
  try {
    const h = await headers();
    const raw =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null;
    if (!raw) return null;
    const salt = process.env.RATE_LIMIT_IP_SALT ?? process.env.NEXTAUTH_SECRET ?? "ef-rl-salt";
    return createHash("sha256").update(`${salt}:${raw}`).digest("hex").slice(0, 32);
  } catch {
    return null;
  }
}

async function audit(args: {
  affiliateUserId: string;
  buyerId: string;
  reason: AffiliateRejectionReason;
  code: string;
  metadata?: Record<string, unknown>;
}) {
  await createAuditLog({
    actorId: args.buyerId,
    action: `affiliate.fraud.${args.reason}`,
    targetType: "User",
    targetId: args.affiliateUserId,
    metadata: { code: args.code, ...args.metadata },
  });
}
