// Recherche transverse (Cmd+K) côté admin.
// Retourne au plus 5 résultats par catégorie : User, Course, Ticket.
// Auth : ADMIN strict (les sous-rôles n'ont pas accès au search global).

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { isAdminRole } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Données très sensibles (emails users, IDs commandes, tickets) : jamais en
// cache navigateur ni CDN.
const PRIVATE_NO_STORE = "private, no-store, max-age=0, must-revalidate";

type Hit = {
  type: "user" | "course" | "ticket";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) {
    return NextResponse.json(
      { hits: [] },
      { status: 403, headers: { "Cache-Control": PRIVATE_NO_STORE } },
    );
  }

  // Rate limit : 60 req/min par admin (IP + userId)
  const rl = await checkRateLimit({
    key: `${clientKey(request.headers, "admin-search")}:${session.user.id}`,
    windowMs: 60_000,
    max: 60,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { hits: [], error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((rl.resetAt - Date.now()) / 1000).toString(),
          "Cache-Control": PRIVATE_NO_STORE,
        },
      },
    );
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json(
      { hits: [] satisfies Hit[] },
      { headers: { "Cache-Control": PRIVATE_NO_STORE } },
    );
  }

  const [users, courses, tickets] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, email: true, name: true, role: true },
      take: 5,
    }),
    prisma.course.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, slug: true, status: true },
      take: 5,
    }),
    prisma.supportTicket.findMany({
      where: {
        OR: [
          { id: { contains: q } },
          { subject: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, subject: true, status: true },
      take: 5,
    }),
  ]);

  const hits: Hit[] = [
    ...users.map((u) => ({
      type: "user" as const,
      id: u.id,
      title: u.name ?? u.email,
      subtitle: `${u.role} · ${u.email}`,
      href: `/admin/utilisateurs/${u.id}`,
    })),
    ...courses.map((c) => ({
      type: "course" as const,
      id: c.id,
      title: c.title,
      subtitle: c.status,
      href: `/admin/cours/${c.id}`,
    })),
    ...tickets.map((t) => ({
      type: "ticket" as const,
      id: t.id,
      title: t.subject,
      subtitle: t.status,
      href: `/admin/support/tickets/${t.id}`,
    })),
  ];

  return NextResponse.json(
    { hits },
    { headers: { "Cache-Control": PRIVATE_NO_STORE } },
  );
}
