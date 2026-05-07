import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import type { TicketPriority, TicketStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Tickets" };

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ status?: TicketStatus; priority?: TicketPriority }>;
}

export default async function AdminTicketsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(params.status ? { status: params.status } : {}),
      ...(params.priority ? { priority: params.priority } : {}),
    },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    take: 100,
    include: {
      requester: { select: { name: true, email: true } },
      assignee: { select: { name: true, email: true } },
      _count: { select: { messages: true } },
    },
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Tickets
          </h1>
          <p className="text-sm text-muted-foreground">
            {tickets.length.toLocaleString("fr-FR")} tickets affichés.
          </p>
        </div>
        <form className="flex gap-2">
          <Select name="status" defaultValue={params.status ?? ""} aria-label="Statut">
            <option value="">Tous statuts</option>
            <option value="OPEN">Ouvert</option>
            <option value="IN_PROGRESS">En cours</option>
            <option value="WAITING_USER">Attente utilisateur</option>
            <option value="RESOLVED">Résolu</option>
            <option value="CLOSED">Fermé</option>
          </Select>
          <Select name="priority" defaultValue={params.priority ?? ""} aria-label="Priorité">
            <option value="">Toutes priorités</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">Haute</option>
            <option value="NORMAL">Normale</option>
            <option value="LOW">Basse</option>
          </Select>
          <Button type="submit" size="sm">Filtrer</Button>
        </form>
      </header>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Sujet</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Priorité</th>
                <th className="hidden px-4 py-3 sm:table-cell">Demandeur</th>
                <th className="hidden px-4 py-3 lg:table-cell">Assigné</th>
                <th className="hidden px-4 py-3 lg:table-cell">Mis à jour</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Aucun ticket.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        {t._count.messages} message{t._count.messages > 1 ? "s" : ""} ·{" "}
                        {t.category}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <TicketStatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {t.requester.name ?? t.requester.email}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                      {t.assignee?.name ?? t.assignee?.email ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                      {t.updatedAt.toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/support/tickets/${t.id}`}
                        className="text-sm font-medium text-[color:var(--brand-secondary)] hover:underline"
                      >
                        Ouvrir →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function TicketStatusBadge({ status }: { status: TicketStatus }) {
  if (status === "OPEN") return <StatusBadge tone="warning">Ouvert</StatusBadge>;
  if (status === "IN_PROGRESS") return <StatusBadge tone="info">En cours</StatusBadge>;
  if (status === "WAITING_USER") return <StatusBadge tone="warning">Attente</StatusBadge>;
  if (status === "RESOLVED") return <StatusBadge tone="success">Résolu</StatusBadge>;
  return <StatusBadge tone="neutral">Fermé</StatusBadge>;
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  if (priority === "URGENT") return <StatusBadge tone="danger">Urgent</StatusBadge>;
  if (priority === "HIGH") return <StatusBadge tone="warning">Haute</StatusBadge>;
  if (priority === "LOW") return <StatusBadge tone="neutral">Basse</StatusBadge>;
  return <StatusBadge tone="info">Normale</StatusBadge>;
}
