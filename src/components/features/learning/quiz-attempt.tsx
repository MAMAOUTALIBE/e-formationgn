"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useState, useTransition } from "react";

import {
  QuizAttemptHistory,
  QuizScoreMeter,
} from "@/components/features/learning/quiz-score-meter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitQuizAttempt, type QuizQuestionReview } from "@/server/actions/quiz";

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
    /** Record ANTÉRIEUR à cette tentative, pour le repère sur la piste. */
    previousBest: number | null;
    review: QuizQuestionReview[] | null;
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
        previousBest: attemptSummary.bestScore,
        review: response.review ?? null,
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
    <div className="space-y-4 rounded-md border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">
        <span>
          Tentatives :{" "}
          <strong className="text-foreground tabular-nums">
            {attemptSummary.attemptsUsed}
          </strong>
          {maxAttempts === null ? "" : ` / ${maxAttempts}`}
        </span>
        <span>
          Restantes :{" "}
          <strong className="text-foreground">
            {attemptSummary.attemptsRemaining === null
              ? "Illimitées"
              : attemptSummary.attemptsRemaining}
          </strong>
        </span>
        <span>
          Score requis :{" "}
          <strong className="text-foreground tabular-nums">{passingScore} / 100</strong>
        </span>
      </div>
      <QuizAttemptHistory attempts={history} passingScore={passingScore} />
    </div>
  );

  if (result) {
    const gap = passingScore - result.score;
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {result.passed ? (
                <CheckCircle2
                  className="h-5 w-5 text-[color:var(--brand-success)]"
                  aria-hidden
                />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" aria-hidden />
              )}
              {result.passed ? "Quiz validé" : "Quiz non validé"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Chiffre de tête : le nombre que l'écran porte, en encre de
                texte. La couleur vit sur le compteur et l'icône, jamais sur
                la valeur — un nombre coloré se lit comme une décoration et
                perd son contraste. */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-5xl font-semibold leading-none tracking-tight text-foreground">
                {result.score}
              </span>
              <span className="text-lg text-muted-foreground">/ 100</span>
              <span className="text-sm text-muted-foreground">
                {result.correctCount} bonne{result.correctCount > 1 ? "s" : ""} réponse
                {result.correctCount > 1 ? "s" : ""} sur {result.totalQuestions}
              </span>
            </div>

            <QuizScoreMeter
              score={result.score}
              passingScore={passingScore}
              passed={result.passed}
              previousBest={result.previousBest}
            />

            <p className="text-sm text-muted-foreground">
              {result.passed
                ? `Vous dépassez le seuil de ${passingScore} / 100.`
                : `Il vous manque ${gap} point${gap > 1 ? "s" : ""} pour atteindre le seuil de ${passingScore} / 100.`}
            </p>

            {!result.passed && !exhausted ? (
              <Button
                type="button"
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                }}
              >
                Refaire le quiz
              </Button>
            ) : null}
            {!result.passed && exhausted ? (
              <Alert variant="destructive">
                <AlertDescription>
                  Vous avez utilisé toutes vos tentatives.
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        {result.review ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Correction</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {result.review.map((item, index) => (
                  <li
                    key={item.questionId}
                    className="border-l-2 pl-4"
                    style={{
                      borderColor: item.correct
                        ? "var(--brand-success)"
                        : "var(--destructive)",
                    }}
                  >
                    <p className="flex items-start gap-2 text-sm font-medium text-foreground">
                      {item.correct ? (
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-success)]"
                          aria-hidden
                        />
                      ) : (
                        <XCircle
                          className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                          aria-hidden
                        />
                      )}
                      <span>
                        <span className="sr-only">
                          {item.correct ? "Réponse juste. " : "Réponse fausse. "}
                        </span>
                        {index + 1}. {item.prompt}
                      </span>
                    </p>
                    <dl className="mt-2 space-y-1 pl-6 text-sm">
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-muted-foreground">Votre réponse :</dt>
                        <dd className="text-foreground">
                          {item.chosenLabels.length > 0
                            ? item.chosenLabels.join(", ")
                            : "aucune"}
                        </dd>
                      </div>
                      {!item.correct ? (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-muted-foreground">Réponse attendue :</dt>
                          <dd className="text-foreground">
                            {item.correctLabels.join(", ")}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                    {item.explanation ? (
                      <p className="mt-2 pl-6 text-sm text-muted-foreground">
                        {item.explanation}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ) : !result.passed ? (
          <p className="px-1 text-xs text-muted-foreground">
            La correction détaillée s&apos;affichera une fois le quiz validé, ou
            lorsque vous n&apos;aurez plus de tentative.
          </p>
        ) : null}

        {attemptOverview}
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
