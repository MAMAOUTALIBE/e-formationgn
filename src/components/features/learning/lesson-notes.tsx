"use client";

import { Trash2 } from "lucide-react";
import { useTransition, useState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createLessonNote, deleteLessonNote } from "@/server/actions/learning";

interface NoteItem {
  id: string;
  content: string;
  videoTimestampSeconds: number | null;
  createdAt: Date;
}

interface LessonNotesProps {
  lessonId: string;
  initialNotes: NoteItem[];
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function LessonNotes({ lessonId, initialNotes }: LessonNotesProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    formData.set("lessonId", lessonId);
    startTransition(async () => {
      const result = await createLessonNote(formData);
      if (result.success) {
        formRef.current?.reset();
        // recharge implicite : on ré-affiche optimiste
        const content = (formData.get("content") as string) ?? "";
        setNotes((prev) => [
          ...prev,
          {
            id: `tmp-${Date.now()}`,
            content,
            videoTimestampSeconds: null,
            createdAt: new Date(),
          },
        ]);
      }
    });
  }

  function handleDelete(noteId: string) {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    startTransition(async () => {
      await deleteLessonNote(noteId);
    });
  }

  return (
    <div className="space-y-4">
      <form
        ref={formRef}
        action={handleSubmit}
        className="space-y-2"
      >
        {/* Étiquette réelle et non simple texte de substitution : un
            placeholder disparaît dès la première frappe et n'est pas restitué
            de façon fiable par les lecteurs d'écran (RGAA 11.1). */}
        <label htmlFor="lesson-note-content" className="text-sm font-medium text-foreground">
          Votre note sur cette leçon
        </label>
        <Textarea
          id="lesson-note-content"
          name="content"
          required
          rows={3}
          maxLength={5000}
          placeholder="Notez les points clés de cette leçon…"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Enregistrement…" : "Ajouter une note"}
        </Button>
      </form>

      {notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune note pour cette leçon.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border bg-card p-3 text-sm"
            >
              <div className="flex-1 space-y-1">
                <p className="whitespace-pre-line text-foreground">{note.content}</p>
                <p className="text-xs text-muted-foreground">
                  {dateFormatter.format(note.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(note.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Supprimer la note"
                disabled={pending || note.id.startsWith("tmp-")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
