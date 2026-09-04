"use client";

// Suivi des prospects issus de l'assistant.
//
// Aiduca n'a pas de CRM externe : cet écran EST le suivi commercial.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { setAssistantLeadStatus } from "@/server/actions/admin-assistant-knowledge";

export interface LeadRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: "NEW" | "IN_PROGRESS" | "CLOSED";
  internalNote: string | null;
  createdAt: Date;
  handledAt: Date | null;
  conversationId: string | null;
  course: { slug: string; title: string } | null;
  handledBy: { name: string | null; email: string } | null;
}

const STATUS_LABEL: Record<LeadRow["status"], string> = {
  NEW: "Nouveau",
  IN_PROGRESS: "En cours",
  CLOSED: "Clôturé",
};

const NEXT_STATUS: Array<{ value: LeadRow["status"]; label: string }> = [
  { value: "NEW", label: "Nouveau" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "CLOSED", label: "Clôturé" },
];

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function AssistantLeadsTable({ rows }: { rows: LeadRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((lead) => [lead.id, lead.internalNote ?? ""])),
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Aucun prospect"
        description="Les demandes de rappel déposées depuis l'assistant apparaîtront ici."
      />
    );
  }

  function updateStatus(id: string, status: LeadRow["status"]) {
    startTransition(async () => {
      const result = await setAssistantLeadStatus(id, status, notes[id] ?? "");
      setNotice(result.message ?? null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {notice ? (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}

      <ul className="space-y-3">
        {rows.map((lead) => (
          <li key={lead.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">{lead.name}</span>
                  <Badge
                    variant={lead.status === "CLOSED" ? "secondary" : "default"}
                  >
                    {STATUS_LABEL[lead.status]}
                  </Badge>
                  {lead.course ? (
                    <Badge variant="outline">{lead.course.title}</Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  <a
                    href={`mailto:${lead.email}`}
                    className="underline underline-offset-4"
                  >
                    {lead.email}
                  </a>
                  {lead.phone ? (
                    <>
                      {" · "}
                      <a
                        href={`tel:${lead.phone.replace(/\s/g, "")}`}
                        className="underline underline-offset-4"
                      >
                        {lead.phone}
                      </a>
                    </>
                  ) : null}
                  {" · "}
                  {dateFormatter.format(lead.createdAt)}
                </p>
              </div>

              <div className="flex flex-wrap gap-1">
                {NEXT_STATUS.filter((s) => s.value !== lead.status).map((status) => (
                  <Button
                    key={status.value}
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => updateStatus(lead.id, status.value)}
                  >
                    {status.label}
                  </Button>
                ))}
              </div>
            </div>

            <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
              {lead.message}
            </p>

            <div className="mt-3 rounded-lg bg-muted/50 p-3">
              <label
                htmlFor={`assistant-lead-note-${lead.id}`}
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Note interne
              </label>
              <textarea
                id={`assistant-lead-note-${lead.id}`}
                value={notes[lead.id] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({
                    ...current,
                    [lead.id]: event.target.value,
                  }))
                }
                rows={2}
                maxLength={2000}
                placeholder="Suivi du rappel, prochaine action…"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={pending || (notes[lead.id] ?? "") === (lead.internalNote ?? "")}
                onClick={() => updateStatus(lead.id, lead.status)}
                className="mt-2"
              >
                Enregistrer la note
              </Button>
            </div>

            {lead.handledBy ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Traité par {lead.handledBy.name ?? lead.handledBy.email}
                {lead.handledAt ? ` le ${dateFormatter.format(lead.handledAt)}` : ""}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
