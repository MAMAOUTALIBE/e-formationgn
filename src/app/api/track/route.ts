// Endpoint d'ingestion tracking — fire-and-forget depuis le client.
//
// Sécurité :
//   - Aucune donnée personnelle stockée hors userId (pas d'IP claire)
//   - Hashage léger côté client : on stocke un sessionId généré
//   - On ignore les bots (User-Agent connu) et les requêtes répétées
// Performance :
//   - Réponse instantanée (204), insertion DB asynchrone (fire and forget)

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOT_PATTERN = /bot|crawl|spider|slurp|fetch|scan/i;

interface TrackPayload {
  path: string;
  sessionId: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

function isValid(payload: unknown): payload is TrackPayload {
  if (typeof payload !== "object" || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.path === "string" &&
    p.path.length > 0 &&
    p.path.length < 500 &&
    typeof p.sessionId === "string" &&
    p.sessionId.length > 6 &&
    p.sessionId.length < 64
  );
}

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (BOT_PATTERN.test(userAgent)) {
    return new NextResponse(null, { status: 204 });
  }

  // Rate limit : 120 hits/min par IP — anti-flood léger
  const rl = await checkRateLimit({
    key: clientKey(request.headers, "track"),
    windowMs: 60_000,
    max: 120,
  });
  if (!rl.ok) return new NextResponse(null, { status: 429 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (!isValid(payload)) {
    return new NextResponse(null, { status: 204 });
  }

  // Best-effort : si la session existe, on la lie au userId.
  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? null;

  // Country sniff via header Vercel/Cloudflare (best effort)
  const country =
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    null;

  // Fire-and-forget : on ne await pas l'insertion DB.
  prisma.pageView
    .create({
      data: {
        path: payload.path.slice(0, 500),
        sessionId: payload.sessionId,
        userId,
        referrer: payload.referrer?.slice(0, 500) ?? null,
        utmSource: payload.utmSource?.slice(0, 100) ?? null,
        utmMedium: payload.utmMedium?.slice(0, 100) ?? null,
        utmCampaign: payload.utmCampaign?.slice(0, 100) ?? null,
        country,
      },
    })
    .catch(() => {
      /* silence — analytics ne doit jamais bloquer */
    });

  return new NextResponse(null, { status: 204 });
}
