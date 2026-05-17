"use client";

// Formulaire inline pour répondre à un avis côté formateur.
// État local : "viewing" (réponse déjà postée) → "editing" (form ouvert)
// → submit → success. Le composant gère son propre cycle sans full refresh.

import { Pencil, Send, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { replyToReview } from "@/server/actions/reviews";

interface InstructorReplyFormProps {
  reviewId: string;
  initialReply: string | null;
  initialRepliedAt: Date | string | null;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function InstructorReplyForm({
  reviewId,
  initialReply,
  initialRepliedAt,
}: InstructorReplyFormProps) {
  const [reply, setReply] = useState(initialReply ?? "");
  const [savedReply, setSavedReply] = useState(initialReply);
  const [savedAt, setSavedAt] = useState<Date | string | null>(initialRepliedAt);
  const [editing, setEditing] = useState(initialReply === null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setFeedback(null);
    const value = reply.trim();
    startTransition(async () => {
      const r = await replyToReview(reviewId, value);
      if (r.success) {
        setSavedReply(value.length > 0 ? value : null);
        setSavedAt(value.length > 0 ? new Date() : null);
        setEditing(value.length === 0);
        setFeedback(r.message ?? "OK");
      } else {
        setFeedback(r.message ?? "Erreur.");
      }
    });
  }

  function remove() {
    setReply("");
    startTransition(async () => {
      const r = await replyToReview(reviewId, "");
      if (r.success) {
        setSavedReply(null);
        setSavedAt(null);
        setEditing(true);
        setFeedback("Réponse supprimée.");
      }
    });
  }

  if (!editing && savedReply) {
    const at =
      savedAt instanceof Date
        ? savedAt
        : savedAt
          ? new Date(savedAt)
          : null;
    return (
      <div className="rounded-md border-l-2 border-[color:var(--brand-secondary)] bg-[color:var(--brand-secondary)]/5 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-secondary)]">
          Réponse du formateur
          {at ? (
            <span className="ml-2 font-normal text-muted-foreground">
              · {dateFormatter.format(at)}
            </span>
          ) : null}
        </p>
        <p className="mt-1.5 whitespace-pre-line text-sm text-foreground">
          {savedReply}
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(true)}
            disabled={pending}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Modifier
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={remove}
            disabled={pending}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Supprimer
          </Button>
        </div>
        {feedback ? (
          <p className="mt-2 text-xs text-[color:var(--brand-success)]" role="status">
            {feedback}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed border-border bg-card p-3">
      <label className="block text-xs font-semibold text-foreground">
        {savedReply ? "Modifier votre réponse" : "Répondre publiquement"}
      </label>
      <Textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Merci pour votre retour. Pour info..."
        disabled={pending}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {reply.length}/2000 caractères. Visible publiquement.
        </p>
        <div className="flex gap-2">
          {savedReply ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setReply(savedReply);
                setEditing(false);
                setFeedback(null);
              }}
              disabled={pending}
            >
              Annuler
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={pending || reply.trim().length < 3}
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            {pending ? "Envoi…" : "Publier"}
          </Button>
        </div>
      </div>
      {feedback ? (
        <p className="text-xs text-muted-foreground" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
