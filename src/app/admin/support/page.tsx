import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Support" };

export const dynamic = "force-dynamic";

function thirtyDaysAgo() {
  return new Date(Date.now() - 30 * 24 * 3600 * 1000);
}

export default async function AdminSupportHubPage() {
  const [openTickets, urgentTickets, openDisputes, recentRefunds] = await Promise.all([
    prisma.supportTicket.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
    prisma.supportTicket.count({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        priority: "URGENT",
      },
    }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    prisma.refund.count({
      where: { createdAt: { gte: thirtyDaysAgo() } },
    }),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Support
        </h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Tickets ouverts" value={openTickets} href="/admin/support/tickets" />
        <KpiCard label="Tickets urgents" value={urgentTickets} href="/admin/support/tickets?priority=URGENT" />
        <KpiCard label="Litiges ouverts" value={openDisputes} href="/admin/support/litiges" />
        <KpiCard label="Remboursements (30 j)" value={recentRefunds} href="/admin/finances/remboursements" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sous-modules</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <li>
              <Link
                href="/admin/support/tickets"
                className="block rounded-md border border-border p-3 hover:bg-muted/50"
              >
                <p className="font-medium">Tickets</p>
                <p className="text-xs text-muted-foreground">
                  Gestion centralisée avec priorité, SLA, assignation.
                </p>
              </Link>
            </li>
            <li>
              <Link
                href="/admin/support/litiges"
                className="block rounded-md border border-border p-3 hover:bg-muted/50"
              >
                <p className="font-medium">Litiges</p>
                <p className="text-xs text-muted-foreground">
                  Médiation entre élève et formateur.
                </p>
              </Link>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
