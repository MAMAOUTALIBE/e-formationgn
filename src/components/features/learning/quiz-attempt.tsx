"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitQuizAttempt } from "@/server/actions/quiz";

interface QuizQuestion {
  id: string;
  prompt: string;
  kind: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  options: Array<{ id: string; label: string }>;
}

interface QuizAttemptProps {
  quizId: string;
  questions: QuizQuestion[];
  passingScore: number;
  maxAttempts: number | null;
  initialAttemptSummary: {
    attemptsUsed: number;
    attemptsRemaining: number | null;
    bestScore: number | null;
    lastScore: number | null;
  };
  initialHistory: Array<{
    id: string;
    attemptNumber: number;
    score: number;
    passed: boolean;
    completedAt: string;
  }>;
}

export function QuizAttempt({
  quizId,
  questions,
  passingScore,
  maxAttempts,
  initialAttemptSummary,
  initialHistory,
}: QuizAttemptProps) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    correctCount: number;
    totalQuestions: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [attemptSummary, setAttemptSummary] = useState(initialAttemptSummary);
  const [history, setHistory] = useState(initialHistory);
  const exhausted = attemptSummary.attemptsRemaining === 0;

  function selectSingle(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: [optionId] }));
  }

  function toggleMultiple(questionId: string, optionId: string) {
    setAnswers((prev) => {
      const current = new Set(prev[questionId] ?? []);
      if (current.has(optionId)) current.delete(optionId);
      else current.add(optionId);
      return { ...prev, [questionId]: Array.from(current) };
    });
  }

  function handleSubmit() {
    setError(null);
    if (Object.keys(answers).length < questions.length) {
      setError("Veuillez répondre à toutes les questions.");
      return;
    }
    startTransition(async () => {
      const payload = {
        answers: questions.map((q) => ({
          questionId: q.id,
          optionIds: answers[q.id] ?? [],
        })),
      };
      const response = await submitQuizAttempt(quizId, payload);
      if (!response.ok) {
        setError(response.message ?? "Erreur lors de l'envoi.");
        return;
      }
      setResult({
        score: response.score ?? 0,
        passed: response.passed ?? false,
        correctCount: response.correctCount ?? 0,
        totalQuestions: response.totalQuestions ?? questions.length,
      });
      setAttemptSummary({
        attemptsUsed: response.attemptsUsed ?? attemptSummary.attemptsUsed + 1,
        attemptsRemaining: response.attemptsRemaining ?? null,
        bestScore: response.bestScore ?? response.score ?? null,
        lastScore: response.lastScore ?? response.score ?? null,
      });
      if (response.attemptId) {
        setHistory((current) => [
          {
            id: response.attemptId!,
            attemptNumber: response.attemptsUsed ?? current.length + 1,
            score: response.score ?? 0,
            passed: response.passed ?? false,
            completedAt: new Date().toISOString(),
          },
          ...current,
        ]);
      }
    });
  }

  const attemptOverview = (
    <div className="space-y-2 rounded-md border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">
        <span>Tentatives : <strong className="text-foreground">{attemptSummary.attemptsUsed}</strong>{maxAttempts === null ? "" : ` / ${maxAttempts}`}</span>
        <span>Restantes : <strong className="text-foreground">{attemptSummary.attemptsRemaining === null ? "Illimitées" : attemptSummary.attemptsRemaining}</strong></span>
        <span>Meilleur score : <strong className="text-foreground">{attemptSummary.bestScore === null ? "—" : `${attemptSummary.bestScore} / 100`}</strong></span>
        <span>Dernier score : <strong className="text-foreground">{attemptSummary.lastScore === null ? "—" : `${attemptSummary.lastScore} / 100`}</strong></span>
      </div>
      {history.length > 0 ? (
        <ol className="space-y-1 border-t border-border pt-2 text-xs text-muted-foreground" aria-label="Historique des tentatives">
          {history.slice(0, 5).map((attempt) => (
            <li key={attempt.id}>
              Tentative {attempt.attemptNumber} · {attempt.score} / 100 · {attempt.passed ? "Réussie" : "Échouée"} · {attempt.completedAt.slice(0, 10)}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );

  if (result) {
    return (
      <div className="space-y-4">
      {attemptOverview}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {result.passed ? (
              <CheckCircle2 className="h-5 w-5 text-[color:var(--brand-success)]" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            {result.passed ? "Quiz validé !" : "Pas tout à fait…"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Score : <strong className="text-foreground">{result.score} / 100</strong>{" "}
            ({result.correctCount} bonnes réponses sur {result.totalQuestions})
          </p>
          <p className="text-xs text-muted-foreground">
            Score requis pour valider : {passingScore} / 100
          </p>
          {!result.passed && !exhausted ? (
            <Button
              type="button"
              onClick={() => {
                setResult(null);
                setAnswers({});
              }}
            >
              Réessayer
            </Button>
          ) : null}
          {!result.passed && exhausted ? (
            <Alert variant="destructive"><AlertDescription>Vous avez utilisé toutes vos tentatives.</AlertDescription></Alert>
          ) : null}
        </CardContent>
      </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {attemptOverview}
      {exhausted ? (
        <Alert variant="destructive"><AlertDescription>La limite de tentatives est atteinte. Contactez votre formateur si nécessaire.</AlertDescription></Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {questions.map((question, index) => (
        <Card key={question.id}>
          <CardHeader>
            <CardTitle className="text-base">
              {index + 1}. {question.prompt}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {question.options.map((option) => {
                const selected = (answers[question.id] ?? []).includes(option.id);
                return (
                  <li key={option.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted">
                      <input
                        type={question.kind === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                        name={`q_${question.id}`}
                        checked={selected}
                        onChange={() => {
                          if (question.kind === "MULTIPLE_CHOICE") {
                            toggleMultiple(question.id, option.id);
                          } else {
                            selectSingle(question.id, option.id);
                          }
                        }}
                        className="mt-0.5"
                      />
                      <span className="text-sm text-foreground">{option.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={pending || exhausted}
        className="w-full"
      >
        {pending ? "Envoi…" : "Valider mes réponses"}
      </Button>
    </div>
  );
}
