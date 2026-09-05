"use client";

import { CheckCircle2, GripVertical, Target, XCircle } from "lucide-react";
import { useState, useTransition } from "react";

import {
  QuizAttemptHistory,
  QuizScoreMeter,
} from "@/components/features/learning/quiz-score-meter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { submitQuizAttempt, type QuizQuestionReview } from "@/server/actions/quiz";

interface QuizQuestion {
  id: string;
  prompt: string;
  kind: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "IMAGE_CHOICE" | "DRAG_DROP" | "HOTSPOT";
  imageUrl: string | null;
  imageAlt: string | null;
  interactionConfig: unknown;
  options: Array<{ id: string; label: string; imageUrl: string | null; imageAlt: string | null }>;
}

function targetsFromConfig(config: unknown): Array<{ id: string; label: string }> {
  if (!config || typeof config !== "object" || !("targets" in config)) return [];
  const targets = (config as { targets?: unknown }).targets;
  if (!Array.isArray(targets)) return [];
  return targets.flatMap((target) =>
    target && typeof target === "object" && "id" in target && "label" in target && typeof target.id === "string" && typeof target.label === "string"
      ? [{ id: target.id, label: target.label }]
      : [],
  );
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
  const [placements, setPlacements] = useState<Record<string, Record<string, string>>>({});
  const [points, setPoints] = useState<Record<string, { x: number; y: number }>>({});
  const [imageOrientations, setImageOrientations] = useState<Record<string, "portrait" | "landscape" | "panorama">>({});
  const [selectedCard, setSelectedCard] = useState<{ questionId: string; optionId: string } | null>(null);
  const [draggedCard, setDraggedCard] = useState<{ questionId: string; optionId: string } | null>(null);
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
    const complete = questions.every((question) => {
      if (question.kind === "DRAG_DROP") {
        return Object.keys(placements[question.id] ?? {}).length === question.options.length;
      }
      if (question.kind === "HOTSPOT") return Boolean(points[question.id]);
      return (answers[question.id] ?? []).length > 0;
    });
    if (!complete) {
      setError("Veuillez répondre à toutes les questions.");
      return;
    }
    startTransition(async () => {
      const payload = {
        answers: questions.map((q) => ({
          questionId: q.id,
          optionIds: answers[q.id] ?? [],
          placements: q.kind === "DRAG_DROP"
            ? Object.entries(placements[q.id] ?? {}).map(([optionId, targetId]) => ({ optionId, targetId }))
            : undefined,
          point: q.kind === "HOTSPOT" ? points[q.id] : undefined,
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
                  setPlacements({});
                  setPoints({});
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

      {questions.map((question, index) => {
        const orientation = imageOrientations[question.id];
        const hasMainImage = Boolean(question.imageUrl);
        return (
        <Card key={question.id} className="overflow-hidden">
          <div
            data-question-media-layout={hasMainImage ? orientation ?? "loading" : "none"}
            className={cn(
              hasMainImage && orientation === "portrait" && "md:grid md:grid-cols-[minmax(220px,38%)_minmax(0,1fr)]",
              hasMainImage && orientation === "landscape" && "xl:grid xl:grid-cols-[minmax(0,56%)_minmax(320px,44%)]",
            )}
          >
            {question.imageUrl ? (
              <div className={cn("flex min-h-0 items-center justify-center bg-muted/50", orientation === "panorama" ? "p-0" : "p-3 sm:p-4")}>
                {question.kind === "HOTSPOT" ? (
                  <div className="w-full space-y-2">
                    <div
                      className="relative mx-auto w-fit max-w-full cursor-crosshair overflow-hidden rounded-lg border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      role="button"
                      tabIndex={0}
                      aria-label="Cliquez sur la zone qui répond à la question"
                      onPointerDown={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        setPoints((current) => ({ ...current, [question.id]: {
                          x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
                          y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
                        } }));
                      }}
                      onKeyDown={(event) => {
                        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", " "].includes(event.key)) return;
                        event.preventDefault();
                        const current = points[question.id] ?? { x: 50, y: 50 };
                        setPoints((all) => ({ ...all, [question.id]: {
                          x: Math.max(0, Math.min(100, current.x + (event.key === "ArrowRight" ? 2 : event.key === "ArrowLeft" ? -2 : 0))),
                          y: Math.max(0, Math.min(100, current.y + (event.key === "ArrowDown" ? 2 : event.key === "ArrowUp" ? -2 : 0))),
                        } }));
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={question.imageUrl}
                        alt={question.imageAlt ?? "Image interactive"}
                        className="block h-auto max-h-[640px] max-w-full object-contain"
                        draggable={false}
                        onLoad={(event) => {
                          const ratio = event.currentTarget.naturalWidth / event.currentTarget.naturalHeight;
                          setImageOrientations((current) => ({ ...current, [question.id]: ratio < 0.9 ? "portrait" : ratio > 2.1 ? "panorama" : "landscape" }));
                        }}
                      />
                      {points[question.id] ? <span className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-[color:var(--brand-secondary)] shadow-[0_0_0_3px_var(--brand-secondary)]" style={{ left: `${points[question.id]!.x}%`, top: `${points[question.id]!.y}%` }} /> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">Cliquez sur l’image. Au clavier, utilisez Entrée puis les flèches.</p>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={question.imageUrl}
                    alt={question.imageAlt ?? "Illustration de la question"}
                    className={cn("block h-auto max-w-full object-contain", orientation === "portrait" ? "max-h-[640px]" : "max-h-[520px]")}
                    onLoad={(event) => {
                      const ratio = event.currentTarget.naturalWidth / event.currentTarget.naturalHeight;
                      setImageOrientations((current) => ({ ...current, [question.id]: ratio < 0.9 ? "portrait" : ratio > 2.1 ? "panorama" : "landscape" }));
                    }}
                  />
                )}
              </div>
            ) : null}
            <div className="min-w-0 self-center">
              <CardHeader>
                <CardTitle className="text-base leading-relaxed">{index + 1}. {question.prompt}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
            {question.kind === "DRAG_DROP" ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">Glissez chaque carte dans une catégorie, ou sélectionnez une carte puis cliquez sur sa catégorie.</p>
                <div className="flex flex-wrap gap-2">
                  {question.options.filter((option) => !(placements[question.id] ?? {})[option.id]).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      draggable
                      onDragStart={() => setDraggedCard({ questionId: question.id, optionId: option.id })}
                      onClick={() => setSelectedCard({ questionId: question.id, optionId: option.id })}
                      className={`flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm hover:bg-muted ${selectedCard?.questionId === question.id && selectedCard.optionId === option.id ? "ring-2 ring-[color:var(--brand-secondary)]" : ""}`}
                    >
                      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />{option.label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {targetsFromConfig(question.interactionConfig).map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (!draggedCard || draggedCard.questionId !== question.id) return;
                        setPlacements((current) => ({ ...current, [question.id]: { ...(current[question.id] ?? {}), [draggedCard.optionId]: target.id } }));
                        setDraggedCard(null);
                      }}
                      onClick={() => {
                        if (!selectedCard || selectedCard.questionId !== question.id) return;
                        setPlacements((current) => ({ ...current, [question.id]: { ...(current[question.id] ?? {}), [selectedCard.optionId]: target.id } }));
                        setSelectedCard(null);
                      }}
                      className="min-h-28 rounded-lg border-2 border-dashed border-border bg-muted/30 p-3 text-left hover:border-[color:var(--brand-secondary)]"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium"><Target className="h-4 w-4" />{target.label}</span>
                      <span className="mt-3 flex flex-wrap gap-2">
                        {question.options.filter((option) => (placements[question.id] ?? {})[option.id] === target.id).map((option) => (
                          <span key={option.id} className="rounded-md border bg-card px-2 py-1 text-xs" onClick={(event) => { event.stopPropagation(); setPlacements((current) => { const next = { ...(current[question.id] ?? {}) }; delete next[option.id]; return { ...current, [question.id]: next }; }); }}>{option.label} <span className="sr-only">— cliquer pour retirer</span></span>
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : question.kind !== "HOTSPOT" ? (
            <ul className={question.kind === "IMAGE_CHOICE" ? "grid gap-3 sm:grid-cols-2" : "space-y-2"}>
              {question.options.map((option) => {
                const selected = (answers[question.id] ?? []).includes(option.id);
                return (
                  <li key={option.id}>
                    <label className={question.kind === "IMAGE_CHOICE" ? "flex h-full cursor-pointer flex-col overflow-hidden rounded-md border border-border hover:bg-muted" : "flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-muted"}>
                      {question.kind === "IMAGE_CHOICE" && option.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={option.imageUrl} alt={option.imageAlt ?? option.label} className="mx-auto block h-auto max-h-[360px] max-w-full object-contain bg-muted" />
                      ) : null}
                      <span className={question.kind === "IMAGE_CHOICE" ? "flex items-start gap-3 p-3" : "contents"}>
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
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            ) : null}
              </CardContent>
            </div>
          </div>
        </Card>
        );
      })}

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
