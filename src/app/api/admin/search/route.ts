// Recherche transverse (Cmd+K) côté admin.
// Retourne au plus 5 résultats par catégorie : User, Course, Order, Ticket.
// Auth : ADMIN strict (les sous-rôles n'ont pas accès au search global).

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Hit = {
  type: "user" | "course" | "order" | "ticket";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) {
    return NextResponse.json({ hits: [] }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ hits: [] satisfies Hit[] });
  }

  const [users, courses, orders, tickets] = await Promise.all([
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
    prisma.order.findMany({
      where: {
        OR: [
          { id: { contains: q } },
          { stripeCheckoutSessionId: { contains: q } },
          { stripePaymentIntentId: { contains: q } },
        ],
      },
      select: { id: true, totalCents: true, currency: true, status: true },
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
    ...orders.map((o) => ({
      type: "order" as const,
      id: o.id,
      title: `Commande ${o.id.slice(0, 8)}…`,
      subtitle: `${(o.totalCents / 100).toFixed(2)} ${o.currency} · ${o.status}`,
      href: `/admin/finances/transactions?order=${o.id}`,
    })),
    ...tickets.map((t) => ({
      type: "ticket" as const,
      id: t.id,
      title: t.subject,
      subtitle: t.status,
      href: `/admin/support/tickets/${t.id}`,
    })),
  ];

  return NextResponse.json({ hits });
}

function isAdminRole(role: string): boolean {
  return ["ADMIN", "MODERATOR", "SUPPORT", "FINANCE"].includes(role);
}
