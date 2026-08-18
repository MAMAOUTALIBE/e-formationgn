"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addQuizQuestion,
  deleteQuizQuestion,
  updateQuizMeta,
} from "@/server/actions/quiz";

type QuestionKind = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";

interface QuizEditorProps {
  lessonId: string;
  lessonTitle: string;
  quiz: {
    title: string;
    description: string | null;
    passingScore: number;
    maxAttempts: number | null;
    questions: Array<{
      id: string;
      prompt: string;
      explanation: string | null;
      kind: QuestionKind;
      points: number;
      options: Array<{ id: string; label: string; isCorrect: boolean }>;
    }>;
  } | null;
}

interface Feedback {
  success: boolean;
  message: string;
}

const KIND_LABELS: Record<QuestionKind, string> = {
  SINGLE_CHOICE: "Choix unique",
  MULTIPLE_CHOICE: "Choix multiples",
  TRUE_FALSE: "Vrai / Faux",
};

const EMPTY_OPTIONS = [
  { label: "", isCorrect: true },
  { label: "", isCorrect: false },
];

export function QuizEditor({ lessonId, lessonTitle, quiz }: QuizEditorProps) {
  const router = useRouter();
  const questionFormRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [kind, setKind] = useState<QuestionKind>("SINGLE_CHOICE");
  const [options, setOptions] = useState(() => EMPTY_OPTIONS.map((option) => ({ ...option })));

  function showResult(result: {
    success: boolean;
    message?: string;
    fieldErrors?: Record<string, string[]>;
  }) {
    const validationMessage = Object.values(result.fieldErrors ?? {})
      .flat()
      .filter(Boolean)
      .join(" ");
    setFeedback({
      success: result.success,
      message:
        result.message ||
        validationMessage ||
        (result.success
          ? "Modification enregistrée."
          : "Vérifiez les champs du formulaire."),
    });
  }

  function handleMetaSubmit(formData: FormData) {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateQuizMeta(lessonId, formData);
      showResult(result);
      if (result.success) router.refresh();
    });
  }

  function handleQuestionSubmit(formData: FormData) {
    setFeedback(null);
    const payload = {
      prompt: formData.get("prompt"),
      explanation: formData.get("explanation"),
      kind,
      points: formData.get("points"),
      options,
    };

    startTransition(async () => {
      const result = await addQuizQuestion(lessonId, payload);
      showResult(result);
      if (result.success) {
        questionFormRef.current?.reset();
        setKind("SINGLE_CHOICE");
        setOptions(EMPTY_OPTIONS.map((option) => ({ ...option })));
        router.refresh();
      }
    });
  }

  function changeKind(nextKind: QuestionKind) {
    setKind(nextKind);
    setOptions(
      nextKind === "TRUE_FALSE"
        ? [
            { label: "Vrai", isCorrect: true },
            { label: "Faux", isCorrect: false },
          ]
        : EMPTY_OPTIONS.map((option) => ({ ...option })),
    );
  }

  function setCorrect(index: number, checked: boolean) {
    setOptions((current) =>
      current.map((option, optionIndex) => ({
        ...option,
        isCorrect:
          kind === "MULTIPLE_CHOICE"
            ? optionIndex === index
              ? checked
              : option.isCorrect
            : optionIndex === index,
      })),
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Configuration du quiz</h3>
        <p className="text-sm text-muted-foreground">
          Définissez les règles, puis ajoutez les questions dans leur ordre d’affichage.
        </p>
      </div>

      {feedback ? (
        <Alert variant={feedback.success ? "success" : "destructive"}>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <form action={handleMetaSubmit} className="space-y-4" aria-label="Paramètres du quiz">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="quiz-title" label="Titre du quiz" required>
            <Input
              id="quiz-title"
              name="title"
              defaultValue={quiz?.title ?? lessonTitle}
              minLength={2}
              maxLength={120}
              required
            />
          </FormField>
          <FormField id="passing-score" label="Score minimum (%)" required>
            <Input
              id="passing-score"
              name="passingScore"
              type="number"
              defaultValue={quiz?.passingScore ?? 70}
              min={0}
              max={100}
              required
            />
          </FormField>
        </div>
        <FormField id="quiz-description" label="Description et consignes">
          <Textarea
            id="quiz-description"
            name="description"
            defaultValue={quiz?.description ?? ""}
            rows={3}
            maxLength={1000}
          />
        </FormField>
        <FormField
          id="max-attempts"
          label="Nombre maximal de tentatives"
          hint="Laissez vide pour autoriser un nombre illimité de tentatives."
        >
          <Input
            id="max-attempts"
            name="maxAttempts"
            type="number"
            defaultValue={quiz?.maxAttempts ?? ""}
            min={1}
            max={50}
            className="sm:max-w-xs"
          />
        </FormField>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>Enregistrer les paramètres</Button>
        </div>
      </form>

      <section className="space-y-4" aria-labelledby="quiz-questions-title">
        <div>
          <h3 id="quiz-questions-title" className="font-semibold">
            Questions ({quiz?.questions.length ?? 0})
          </h3>
          <p className="text-sm text-muted-foreground">
            Les coches vertes indiquent les réponses considérées comme correctes.
          </p>
        </div>

        {!quiz || quiz.questions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="font-medium">Aucune question pour le moment</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Utilisez le formulaire ci-dessous pour créer la première question.
            </p>
          </div>
        ) : (
          <ol className="space-y-3">
            {quiz.questions.map((question, questionIndex) => (
              <li key={question.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Question {questionIndex + 1}</span>
                      <span>·</span>
                      <span>{KIND_LABELS[question.kind]}</span>
                      <span>·</span>
                      <span>{question.points} point{question.points > 1 ? "s" : ""}</span>
                    </div>
                    <p className="font-medium text-foreground">{question.prompt}</p>
                    <ul className="grid gap-1 text-sm sm:grid-cols-2">
                      {question.options.map((option) => (
                        <li key={option.id} className="flex items-center gap-2 text-muted-foreground">
                          {option.isCorrect ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--brand-success)]" aria-label="Réponse correcte" />
                          ) : (
                            <span className="h-4 w-4 shrink-0 rounded-full border border-border" aria-hidden />
                          )}
                          {option.label}
                        </li>
                      ))}
                    </ul>
                    {question.explanation ? (
                      <p className="text-xs text-muted-foreground">Explication : {question.explanation}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    aria-label={`Supprimer la question ${questionIndex + 1}`}
                    onClick={() => {
                      if (!window.confirm(`Supprimer la question ${questionIndex + 1} ?`)) return;
                      startTransition(async () => {
                        const result = await deleteQuizQuestion(question.id);
                        showResult(result);
                        if (result.success) router.refresh();
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <form ref={questionFormRef} action={handleQuestionSubmit} className="space-y-4 rounded-lg border border-border bg-muted/20 p-4" aria-label="Ajouter une question">
        <h3 className="font-semibold">Ajouter une question</h3>
        <FormField id="question-prompt" label="Énoncé" required>
          <Textarea id="question-prompt" name="prompt" rows={3} minLength={5} maxLength={500} required />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="question-kind" label="Type de question">
            <Select id="question-kind" value={kind} onChange={(event) => changeKind(event.target.value as QuestionKind)}>
              <option value="SINGLE_CHOICE">Choix unique</option>
              <option value="MULTIPLE_CHOICE">Choix multiples</option>
              <option value="TRUE_FALSE">Vrai / Faux</option>
            </Select>
          </FormField>
          <FormField id="question-points" label="Points">
            <Input id="question-points" name="points" type="number" defaultValue={1} min={1} max={10} />
          </FormField>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Réponses proposées</legend>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-3">
              <Checkbox
                checked={option.isCorrect}
                onChange={(event) => setCorrect(index, event.target.checked)}
                aria-label={`Marquer la réponse ${index + 1} comme correcte`}
              />
              <Input
                value={option.label}
                onChange={(event) =>
                  setOptions((current) => current.map((item, optionIndex) => optionIndex === index ? { ...item, label: event.target.value } : item))
                }
                disabled={kind === "TRUE_FALSE"}
                required
                maxLength={300}
                aria-label={`Réponse ${index + 1}`}
                placeholder={`Réponse ${index + 1}`}
              />
              {kind !== "TRUE_FALSE" && options.length > 2 ? (
                <Button type="button" variant="ghost" size="icon" onClick={() => setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index))} aria-label={`Retirer la réponse ${index + 1}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))}
          {kind !== "TRUE_FALSE" && options.length < 8 ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setOptions((current) => [...current, { label: "", isCorrect: false }])}>
              <Plus className="h-4 w-4" /> Ajouter une réponse
            </Button>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {kind === "MULTIPLE_CHOICE" ? "Cochez toutes les bonnes réponses." : "Cochez l’unique bonne réponse."}
          </p>
        </fieldset>

        <FormField id="question-explanation" label="Explication (optionnelle)" hint="Affichée à l’élève après sa tentative.">
          <Textarea id="question-explanation" name="explanation" rows={2} maxLength={1000} />
        </FormField>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            <Plus className="h-4 w-4" /> {pending ? "Enregistrement…" : "Ajouter la question"}
          </Button>
        </div>
      </form>
    </div>
  );
}
