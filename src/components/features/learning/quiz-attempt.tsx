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
}

export function QuizAttempt({ quizId, questions, passingScore }: QuizAttemptProps) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    correctCount: number;
    totalQuestions: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
    });
  }

  if (result) {
    return (
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
          {!result.passed ? (
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
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
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
        disabled={pending}
        className="w-full"
      >
        {pending ? "Envoi…" : "Valider mes réponses"}
      </Button>
    </div>
  );
}
