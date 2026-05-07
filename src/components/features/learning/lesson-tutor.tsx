"use client";

// Tuteur IA disponible dans le viewer de leçon. L'élève pose une question,
// le composant appelle la Server Action `askLessonTutor` et affiche la
// réponse. Pas de streaming dans cette première itération.

import { Bot, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { askLessonTutor } from "@/server/actions/tutor";

interface Exchange {
  question: string;
  answer: string;
}

export function LessonTutor({ lessonId }: { lessonId: string }) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    const trimmed = question.trim();
    if (trimmed.length < 5) {
      toast.error("Pose une question plus précise.");
      return;
    }
    setPending(true);
    try {
      const result = await askLessonTutor(lessonId, trimmed);
      if (!result.ok) {
        toast.error(result.message ?? "Échec.");
        return;
      }
      setHistory((h) => [...h, { question: trimmed, answer: result.answer ?? "" }]);
      setQuestion("");
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--brand-violet)]/15 text-[color:var(--brand-violet-deep)]">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <CardTitle className="text-base">Tuteur IA</CardTitle>
          <p className="text-xs text-muted-foreground">
            Pose une question sur la leçon. Réponse en quelques secondes.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.length > 0 ? (
          <ul className="space-y-3">
            {history.map((ex, i) => (
              <li key={i} className="space-y-2">
                <div className="rounded-md bg-muted px-3 py-2 text-sm">
                  <strong className="block text-xs uppercase tracking-wide text-muted-foreground">
                    Toi
                  </strong>
                  {ex.question}
                </div>
                <div className="rounded-md border border-[color:var(--brand-violet)]/30 bg-[color:var(--brand-violet)]/5 px-3 py-2 text-sm">
                  <strong className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-[color:var(--brand-violet-deep)]">
                    <Bot className="h-3 w-3" aria-hidden />
                    Tuteur
                  </strong>
                  <p className="mt-1 whitespace-pre-wrap">{ex.answer}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="space-y-2">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex: Pourquoi utilise-t-on un tableau associatif ici ?"
            rows={3}
            disabled={pending}
            maxLength={1500}
          />
          <div className="flex justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Limite : 10 questions / heure. Pour les sujets hors leçon, utilise
              l&apos;onglet Q&amp;A du cours.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={pending || question.trim().length < 5}
            >
              {pending ? "Réflexion…" : "Demander"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
