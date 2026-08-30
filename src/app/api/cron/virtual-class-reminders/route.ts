import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { notifyVirtualClass } from "@/server/services/virtual-class-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOWS = [
  { kind: "REMINDER_24H" as const, offsetMinutes: 24 * 60, toleranceMinutes: 5 },
  { kind: "REMINDER_1H" as const, offsetMinutes: 60, toleranceMinutes: 5 },
  { kind: "REMINDER_15M" as const, offsetMinutes: 15, toleranceMinutes: 5 },
];

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  let sent = 0;
  for (const window of WINDOWS) {
    const target = new Date(now.getTime() + window.offsetMinutes * 60_000);
    const tolerance = window.toleranceMinutes * 60_000;
    const classes = await prisma.virtualClassSession.findMany({
      where: { status: "SCHEDULED", startsAt: { gte: new Date(target.getTime() - tolerance), lt: new Date(target.getTime() + tolerance) } },
      select: { id: true, startsAt: true },
      take: 200,
    });
    for (const item of classes) {
      const result = await notifyVirtualClass({ virtualClassId: item.id, kind: window.kind, keySuffix: item.startsAt.toISOString(), scheduledFor: item.startsAt });
      sent += result.sent;
    }
  }
  return NextResponse.json({ ok: true, sent });
}
