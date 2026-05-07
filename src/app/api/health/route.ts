// Endpoint de santé pour les sondes de l'hébergeur (Vercel, Render, Fly, etc.)
// et la supervision (UptimeRobot, BetterStack...).
//
// Renvoie 200 si l'application répond et que la base est joignable, 503 sinon.
// Volontairement minimaliste — aucune information sensible exposée.

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        uptimeSeconds: Math.round(process.uptime()),
        latencyMs: Date.now() - startedAt,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", reason: "database" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
