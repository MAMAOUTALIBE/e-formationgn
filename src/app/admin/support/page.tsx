import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  LifeBuoy,
  MessageSquare,
  RefreshCw,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Support — CRM admin" };

export const dynamic = "force-dynamic";

function thirtyDaysAgo() {
  return new Date(Date.now() - 30 * 24 * 3600 * 1000);
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 3600 * 1000);
}

export default async function AdminSupportHubPage() {
  const now = new Date();

  const [
    openTickets,
    urgentTickets,
    openDisputes,
    recentRefunds,
    slaBreached,
    oldOpen,
    closedThisMonth,
    avgResponseStats,
    oldestOpen,
  ] = await Promise.all([
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
    // SLA dépassés : ticket ouvert dont slaDueAt < maintenant
    prisma.supportTicket.count({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        slaDueAt: { lt: now },
      },
    }),
    // Tickets ouverts > 7 jours
    prisma.supportTicket.count({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        createdAt: { lt: daysAgo(7) },
      },
    }),
    // Tickets fermés ces 30 jours
    prisma.supportTicket.count({
      where: {
        status: "CLOSED",
        closedAt: { gte: thirtyDaysAgo() },
      },
    }),
    // Temps moyen de réponse : pour chaque ticket, on regarde le délai entre
    // ticket.createdAt et le premier message non-internal d'un staff.
    // Aggrégation côté JS (Prisma ne permet pas ce calcul en SQL pur simplement).
    prisma.supportTicket
      .findMany({
        where: { closedAt: { gte: thirtyDaysAgo() }, status: "CLOSED" },
        select: {
          createdAt: true,
          messages: {
            where: { isInternalNote: false },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true, authorId: true },
            take: 5,
          },
          requesterId: true,
        },
        take: 100,
      })
      .then((tickets) => {
        const deltas: number[] = [];
        for (const t of tickets) {
          const firstStaffMsg = t.messages.find(
            (m) => m.authorId !== t.requesterId,
          );
          if (firstStaffMsg) {
            deltas.push(firstStaffMsg.createdAt.getTime() - t.createdAt.getTime());
          }
        }
        if (deltas.length === 0) return { avgMs: 0, sampleSize: 0 };
        const sum = deltas.reduce((s, d) => s + d, 0);
        return { avgMs: sum / deltas.length, sampleSize: deltas.length };
      }),
    // Plus vieux ticket ouvert
    prisma.supportTicket.findFirst({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        subject: true,
        createdAt: true,
        priority: true,
        requester: { select: { name: true, email: true } },
      },
    }),
  ]);

  const formatDuration = (ms: number): string => {
    const hours = ms / (1000 * 60 * 60);
    if (hours < 1) return `${Math.round(ms / 60000)} min`;
    if (hours < 24) return `${hours.toFixed(1)} h`;
    return `${(hours / 24).toFixed(1)} j`;
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <LifeBuoy
            className="h-6 w-6 text-[color:var(--brand-primary)]"
            aria-hidden
          />
          Support
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tickets, litiges et remboursements — pulse opérationnel de la
          plateforme.
        </p>
      </header>

      {/* Alerte SLA dépassés */}
      {slaBreached > 0 ? (
        <section className="flex items-start gap-3 rounded-lg border border-[color:var(--brand-danger)]/30 bg-[color:var(--brand-danger)]/5 p-4">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--brand-danger)]"
            aria-hidden
          />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-foreground">
              {slaBreached} ticket{slaBreached > 1 ? "s" : ""} hors SLA
            </p>
            <p className="mt-0.5 text-muted-foreground">
              À traiter en priorité — risque de churn / réputation.
            </p>
          </div>
          <Link
            href="/admin/support/tickets?status=OPEN"
            className="shrink-0 text-sm font-medium text-[color:var(--brand-danger)] hover:underline"
          >
            Voir les tickets →
          </Link>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Tickets ouverts"
          value={openTickets}
          icon={<MessageSquare className="h-4 w-4" />}
          href="/admin/support/tickets?status=OPEN"
        />
        <KpiCard
          label="Tickets urgents"
          value={urgentTickets}
          icon={<AlertCircle className="h-4 w-4" />}
          href="/admin/support/tickets?priority=URGENT"
          hint={urgentTickets > 0 ? "À prioriser" : "Aucun urgent"}
        />
        <KpiCard
          label="SLA dépassés"
          value={slaBreached}
          icon={<Clock className="h-4 w-4" />}
          hint={
            slaBreached > 0
              ? "⚠ traiter maintenant"
              : "Tous dans les délais"
          }
        />
        <KpiCard
          label="Ouverts > 7 jours"
          value={oldOpen}
          icon={<AlertTriangle className="h-4 w-4" />}
          hint="Aging à investiguer"
        />
        <KpiCard
          label="Litiges ouverts"
          value={openDisputes}
          icon={<AlertCircle className="h-4 w-4" />}
          href="/admin/support/litiges"
        />
        <KpiCard
          label="Remboursements 30j"
          value={recentRefunds}
          icon={<RefreshCw className="h-4 w-4" />}
          href="/admin/finances/remboursements"
        />
        <KpiCard
          label="Tickets fermés 30j"
          value={closedThisMonth}
          icon={<MessageSquare className="h-4 w-4" />}
          hint="Volume traité"
        />
        <KpiCard
          label="Temps réponse moy."
          value={
            avgResponseStats.sampleSize > 0
              ? formatDuration(avgResponseStats.avgMs)
              : "—"
          }
          icon={<Clock className="h-4 w-4" />}
          hint={
            avgResponseStats.sampleSize > 0
              ? `Sur ${avgResponseStats.sampleSize} tickets fermés`
              : "Pas assez de données"
          }
        />
      </section>

      {oldestOpen ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Plus vieux ticket ouvert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/admin/support/tickets/${oldestOpen.id}`}
                  className="block truncate font-medium text-foreground hover:underline"
                >
                  {oldestOpen.subject}
                </Link>
                <p className="text-xs text-muted-foreground">
                  Demandé par{" "}
                  {oldestOpen.requester.name ?? oldestOpen.requester.email} ·
                  Ouvert le{" "}
                  {oldestOpen.createdAt.toLocaleDateString("fr-FR")} (
                  {formatDuration(now.getTime() - oldestOpen.createdAt.getTime())}{" "}
                  d&apos;ancienneté)
                </p>
              </div>
              <StatusBadge
                tone={oldestOpen.priority === "URGENT" ? "danger" : "warning"}
              >
                {oldestOpen.priority}
              </StatusBadge>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sous-modules</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <li>
              <Link
                href="/admin/support/tickets"
                className="flex items-start gap-3 rounded-md border border-border p-3 hover:border-[color:var(--brand-secondary)] hover:bg-muted/50"
              >
                <MessageSquare
                  className="mt-0.5 h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                <div>
                  <p className="font-medium">Tickets</p>
                  <p className="text-xs text-muted-foreground">
                    Gestion centralisée avec priorité, SLA, assignation.
                  </p>
                </div>
              </Link>
            </li>
            <li>
              <Link
                href="/admin/support/litiges"
                className="flex items-start gap-3 rounded-md border border-border p-3 hover:border-[color:var(--brand-secondary)] hover:bg-muted/50"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                <div>
                  <p className="font-medium">Litiges</p>
                  <p className="text-xs text-muted-foreground">
                    Médiation entre élève et formateur, suivi disputes Stripe.
                  </p>
                </div>
              </Link>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
