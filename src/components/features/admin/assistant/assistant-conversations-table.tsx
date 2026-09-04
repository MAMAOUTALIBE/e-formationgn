"use client";

// Liste des conversations + transcript en tiroir.
//
// Le transcript est chargé à la demande : embarquer tous les messages de
// toutes les conversations dans la page rendrait la liste inutilisable dès
// quelques centaines de fils.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { EmptyState } from "@/components/ui/empty-state";
import {
  deleteAssistantConversation,
  getAssistantConversationTranscript,
  type AssistantTranscript,
} from "@/server/actions/admin-assistant-knowledge";

export interface ConversationRow {
  id: string;
  publicId: string;
  startedAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  escalated: boolean;
  user: { name: string | null; email: string } | null;
  messages: Array<{ content: string }>;
  _count: { messages: number };
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function AssistantConversationsTable({ rows }: { rows: ConversationRow[] }) {
  const router = useRouter();
  const [transcript, setTranscript] = useState<AssistantTranscript | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState<ConversationRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Aucune conversation"
        description="Les échanges apparaîtront ici dès que des visiteurs utiliseront l'assistant."
      />
    );
  }

  async function open(id: string) {
    setLoading(true);
    try {
      setTranscript(await getAssistantConversationTranscript(id));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {notice ? (
        <p role="status" className="mb-3 rounded-lg bg-muted px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-medium">Première question</th>
              <th scope="col" className="py-2 pr-3 font-medium">Visiteur</th>
              <th scope="col" className="py-2 pr-3 font-medium">Messages</th>
              <th scope="col" className="py-2 pr-3 font-medium">Dernier échange</th>
              <th scope="col" className="py-2 pr-3 font-medium">État</th>
              <th scope="col" className="py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60">
                <td className="max-w-sm py-2 pr-3">
                  <button
                    type="button"
                    onClick={() => void open(row.id)}
                    className="line-clamp-2 text-left text-foreground underline-offset-4 hover:underline"
                  >
                    {row.messages[0]?.content ?? "(conversation vide)"}
                  </button>
                </td>
                <td className="py-2 pr-3 text-muted-foreground">
                  {row.user ? (row.user.name ?? row.user.email) : "Visiteur anonyme"}
                </td>
                <td className="py-2 pr-3 text-muted-foreground">{row.messageCount}</td>
                <td className="py-2 pr-3 text-muted-foreground">
                  {dateFormatter.format(row.lastMessageAt)}
                </td>
                <td className="py-2 pr-3">
                  <div className="flex flex-wrap gap-1">
                    {row.escalated ? <Badge>Escaladée</Badge> : null}
                    {row._count.messages > 0 ? (
                      <Badge variant="outline">
                        {row._count.messages} sans réponse
                      </Badge>
                    ) : null}
                  </div>
                </td>
                <td className="py-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Supprimer la conversation"
                    onClick={() => setConfirming(row)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DetailDrawer
        open={transcript !== null || loading}
        onClose={() => setTranscript(null)}
        title="Conversation"
        description={
          transcript
            ? `Ouverte le ${dateFormatter.format(new Date(transcript.startedAt))}`
            : undefined
        }
        size="lg"
      >
        {loading || !transcript ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <ol className="space-y-3">
            {transcript.messages.map((message) => (
              <li
                key={message.id}
                className={
                  message.role === "USER"
                    ? "rounded-xl bg-[color:var(--brand-secondary)]/10 p-3"
                    : "rounded-xl bg-muted p-3"
                }
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {message.role === "USER" ? "Visiteur" : "Aiduca-IA"}
                  {message.role === "ASSISTANT" && !message.answered
                    ? " · sans réponse certaine"
                    : ""}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {message.content}
                </p>
                {message.courseSlugs.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Formations citées : {message.courseSlugs.join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Supprimer cette conversation ?"
        description="Les messages seront définitivement supprimés. Un éventuel prospect issu de cette conversation est conservé."
        destructive
        confirmLabel="Supprimer"
        onConfirm={async () => {
          if (!confirming) return;
          const result = await deleteAssistantConversation(confirming.id);
          setConfirming(null);
          setNotice(result.message ?? null);
          router.refresh();
        }}
      />
    </>
  );
}
