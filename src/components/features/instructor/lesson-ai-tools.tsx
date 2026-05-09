"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { generateQuizQuestionsForLesson } from "@/server/actions/ai-quiz";
import { regenerateLessonSummary } from "@/server/actions/ai-lesson-summary";

interface LessonAiToolsProps {
  lessonId: string;
  courseId: string;
  initialSummary: string | null;
  initialUpdatedAt: Date | null;
  /** Si false, l'UI affiche un message désactivé (pas de bouton). */
  aiAvailable: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function LessonAiTools({
  lessonId,
  courseId,
  initialSummary,
  initialUpdatedAt,
  aiAvailable,
}: LessonAiToolsProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(
    initialUpdatedAt ? new Date(initialUpdatedAt) : null,
  );
  const [summaryPending, startSummary] = useTransition();
  const [quizPending, startQuiz] = useTransition();
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  function handleRegenerate() {
    setNotice(null);
    startSummary(async () => {
      const result = await regenerateLessonSummary(lessonId);
      if (!result.ok || !result.summary) {
        setNotice({
          kind: "error",
          message: result.message ?? "Échec de la génération.",
        });
        return;
      }
      setSummary(result.summary);
      setUpdatedAt(new Date());
      setNotice({ kind: "success", message: "Résumé régénéré." });
    });
  }

  function handleGenerateQuiz() {
    setNotice(null);
    startQuiz(async () => {
      const result = await generateQuizQuestionsForLesson(lessonId);
      if (!result.ok) {
        setNotice({
          kind: "error",
          message: result.message ?? "Échec de la génération du quiz.",
        });
        return;
      }
      setNotice({
        kind: "success",
        message: `${result.added ?? 0} question(s) ajoutée(s) au quiz de la leçon.`,
      });
    });
  }

  if (!aiAvailable) {
    return (
      <Alert variant="info">
        <AlertDescription>
          Génération IA indisponible (clé API non configurée).
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section : Résumé pédagogique */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Résumé pédagogique
            </p>
            <p className="text-xs text-muted-foreground">
              Affiché aux élèves au-dessus de la leçon (3-5 puces). 10 régénérations / heure.
            </p>
            {updatedAt ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Dernière mise à jour : {dateFormatter.format(updatedAt)}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleRegenerate}
            disabled={summaryPending}
          >
            {summaryPending
              ? "Génération…"
              : summary
                ? "Régénérer"
                : "Générer"}
          </Button>
        </div>

        {summary ? (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="prose prose-sm max-w-none whitespace-pre-line text-foreground">
              {summary}
            </div>
          </div>
        ) : null}
      </section>

      {/* Section : Génération de quiz */}
      <section className="space-y-2 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Quiz généré par IA
            </p>
            <p className="text-xs text-muted-foreground">
              Crée 3-5 questions QCM/Vrai-Faux à partir du contenu de la leçon.
              Les questions sont ajoutées au quiz existant. 5 générations / heure.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleGenerateQuiz}
              disabled={quizPending}
            >
              {quizPending ? "Génération…" : "Générer un quiz"}
            </Button>
            <Button asChild variant="link" size="sm" className="h-auto px-0">
              <Link href={`/formateur/cours/${courseId}/programme`}>
                Voir le programme
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {notice ? (
        <Alert variant={notice.kind === "success" ? "success" : "destructive"}>
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
