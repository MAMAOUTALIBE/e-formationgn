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
  let failed = 0;
  for (const window of WINDOWS) {
    const target = new Date(now.getTime() + window.offsetMinutes * 60_000);
    const tolerance = window.toleranceMinutes * 60_000;
    // La requête elle-même est isolée : une coupure de base sur une fenêtre
    // faisait échouer tout le passage, y compris les fenêtres déjà traitées,
    // dont les rappels étaient alors comptés comme non envoyés.
    let classes;
    try {
      classes = await prisma.virtualClassSession.findMany({
        where: { status: "SCHEDULED", startsAt: { gte: new Date(target.getTime() - tolerance), lt: new Date(target.getTime() + tolerance) } },
        select: { id: true, startsAt: true },
        take: 200,
      });
    } catch (error) {
      failed++;
      console.error(`[cron] fenêtre de rappel ${window.kind} illisible`, error);
      continue;
    }
    for (const item of classes) {
      // Isolé séance par séance : une seule ligne en défaut (fuseau illisible,
      // e-mail refusé…) faisait auparavant échouer tout le passage, et les
      // rappels des autres séances de la fenêtre étaient perdus sans reprise.
      try {
        const result = await notifyVirtualClass({ virtualClassId: item.id, kind: window.kind, keySuffix: item.startsAt.toISOString(), scheduledFor: item.startsAt });
        sent += result.sent;
      } catch (error) {
        failed++;
        console.error(`[cron] rappel de classe virtuelle ${item.id} en échec`, error);
      }
    }
  }
  // `ok` reflète la réalité : un passage partiellement en échec ne doit pas
  // être vu comme réussi par la supervision.
  return NextResponse.json({ ok: failed === 0, sent, failed }, { status: failed ? 207 : 200 });
}
