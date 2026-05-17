"use client";

// Form de création d'une annonce — usage côté formateur.
// Reset au succès, feedback inline. Simple useTransition.

import { Send } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createAnnouncement } from "@/server/actions/announcements";

interface AnnouncementFormProps {
  courseId: string;
}

export function AnnouncementForm({ courseId }: AnnouncementFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(
    null,
  );

  function action(formData: FormData) {
    setFeedback(null);
    startTransition(async () => {
      const r = await createAnnouncement(formData);
      if (r.success) {
        formRef.current?.reset();
        setFeedback({ kind: "ok", message: r.message ?? "Publié." });
      } else {
        setFeedback({
          kind: "error",
          message: r.message ?? "Erreur de publication.",
        });
      }
    });
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      <div className="space-y-1">
        <Label htmlFor="ann-title">Titre</Label>
        <Input
          id="ann-title"
          name="title"
          required
          minLength={3}
          maxLength={120}
          placeholder="Nouveau module disponible !"
          disabled={pending}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="ann-body">Message</Label>
        <Textarea
          id="ann-body"
          name="body"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          placeholder="Bonjour à toutes et tous, je viens d'ajouter…"
          disabled={pending}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Visible par tous les élèves inscrits à ce cours.
        </p>
        <Button type="submit" disabled={pending}>
          <Send className="h-4 w-4" aria-hidden />
          {pending ? "Publication…" : "Publier l'annonce"}
        </Button>
      </div>
      {feedback ? (
        <p
          role="status"
          className={`text-sm ${
            feedback.kind === "ok"
              ? "text-[color:var(--brand-success)]"
              : "text-destructive"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </form>
  );
}
