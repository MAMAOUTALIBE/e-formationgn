"use server";

// Capture du code d'affiliation depuis ?ref=<code> et persistance en cookie.
// Appelé depuis un effet côté client (cf. AffiliateTracker), ou à la volée
// par les Server Actions si nécessaire.

import { prisma } from "@/lib/prisma";
import { setAffiliateCode } from "@/lib/affiliate";

export async function trackAffiliateRef(code: string): Promise<{ ok: boolean }> {
  if (!code || code.length < 3 || code.length > 64) return { ok: false };

  // Vérifie l'existence du code (best-effort, anti-pollution).
  const owner = await prisma.user.findUnique({
    where: { affiliateCode: code },
    select: { id: true },
  });
  if (!owner) return { ok: false };

  await setAffiliateCode(code);
  return { ok: true };
}
