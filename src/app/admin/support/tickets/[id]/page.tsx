import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import {
  createTicketReply,
  setTicketPriority,
  updateTicketStatus,
} from "@/server/actions/admin-support";
import { prisma } from "@/lib/prisma";
import type { TicketPriority, TicketStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Ticket" };

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminTicketDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { name: true, email: true, role: true } },
        },
      },
    },
  });
  if (!ticket) notFound();

  return (
    <div className="space-y-5">
      <Link
        href="/admin/support/tickets"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Retour aux tickets
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {ticket.subject}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ouvert par{" "}
            <Link
              href={`/admin/utilisateurs/${ticket.requester.id}`}
              className="hover:underline"
            >
              {ticket.requester.name ?? ticket.requester.email}
            </Link>{" "}
            · {ticket.createdAt.toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form
            action={async (formData: FormData) => {
              "use server";
              await updateTicketStatus(
                ticket.id,
                formData.get("status") as TicketStatus,
              );
            }}
            className="flex items-center gap-1"
          >
            <Select name="status" defaultValue={ticket.status} aria-label="Statut">
              <option value="OPEN">Ouvert</option>
              <option value="IN_PROGRESS">En cours</option>
              <option value="WAITING_USER">Attente</option>
              <option value="RESOLVED">Résolu</option>
              <option value="CLOSED">Fermé</option>
            </Select>
            <Button type="submit" size="sm" variant="outline">OK</Button>
          </form>

          <form
            action={async (formData: FormData) => {
              "use server";
              await setTicketPriority(
                ticket.id,
                formData.get("priority") as TicketPriority,
              );
            }}
            className="flex items-center gap-1"
          >
            <Select name="priority" defaultValue={ticket.priority} aria-label="Priorité">
              <option value="LOW">Basse</option>
              <option value="NORMAL">Normale</option>
              <option value="HIGH">Haute</option>
              <option value="URGENT">Urgent</option>
            </Select>
            <Button type="submit" size="sm" variant="outline">OK</Button>
          </form>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-3">
            {ticket.messages.map((m) => (
              <li
                key={m.id}
                className={`rounded-md border p-3 text-sm ${m.isInternalNote ? "border-amber-300 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30" : "border-border bg-background"}`}
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {m.author.name ?? m.author.email}
                    {m.isInternalNote ? (
                      <StatusBadge tone="warning" className="ml-2">
                        Note interne
                      </StatusBadge>
                    ) : null}
                  </span>
                  <time>{m.createdAt.toLocaleString("fr-FR")}</time>
                </div>
                <p className="whitespace-pre-wrap text-foreground">{m.body}</p>
              </li>
            ))}
            {ticket.messages.length === 0 ? (
              <li className="text-sm text-muted-foreground">Aucun message.</li>
            ) : null}
          </ul>

          <form
            action={async (formData: FormData) => {
              "use server";
              await createTicketReply(
                ticket.id,
                String(formData.get("body") ?? ""),
                formData.get("isInternalNote") === "on",
              );
            }}
            className="space-y-2"
          >
            <Textarea name="body" rows={4} placeholder="Votre réponse…" required />
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" name="isInternalNote" />
                Note interne (non visible par le demandeur)
              </label>
              <Button type="submit" size="sm">
                Envoyer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
