// Live feed admin — endpoint polling pour LiveActivityFeed.
//
// Retourne les N dernières activités (signups + orders payés). Admin only.
// Rate-limit léger : 1 req / 5s par admin pour éviter les boucles infinies
// côté client si bug.

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { ADMIN_ROLES } from "@/lib/constants";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

const PRIVATE_NO_STORE = "private, no-store, max-age=0";
const LIMIT = 15;

export async function GET() {
  const session = await auth();
  if (
    !session?.user ||
    !(ADMIN_ROLES as readonly string[]).includes(session.user.role)
  ) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rl = await checkRateLimit({
    key: `admin:live-feed:${session.user.id}`,
    windowMs: 5_000,
    max: 2,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Cache-Control": PRIVATE_NO_STORE } },
    );
  }

  const [signups, orders] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: LIMIT,
      select: {
        id: true,
        totalCents: true,
        currency: true,
        paidAt: true,
        user: { select: { name: true, email: true } },
        items: {
          select: { course: { select: { title: true } } },
          take: 1,
        },
      },
    }),
  ]);

  type Item = {
    kind: "signup" | "order";
    id: string;
    at: string;
    title: string;
    subtitle: string;
  };
  const items: Item[] = [
    ...signups.map(
      (s): Item => ({
        kind: "signup",
        id: `s:${s.id}`,
        at: s.createdAt.toISOString(),
        title: s.name ?? s.email,
        subtitle: "Nouveau compte",
      }),
    ),
    ...orders.map((o): Item => {
      const courseTitle = o.items[0]?.course.title ?? "Commande";
      return {
        kind: "order",
        id: `o:${o.id}`,
        at: (o.paidAt ?? new Date()).toISOString(),
        title: o.user.name ?? o.user.email,
        subtitle: `${courseTitle} · ${(o.totalCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${o.currency}`,
      };
    }),
  ];

  items.sort((a, b) => b.at.localeCompare(a.at));

  return NextResponse.json(
    { items: items.slice(0, LIMIT) },
    { headers: { "Cache-Control": PRIVATE_NO_STORE } },
  );
}
