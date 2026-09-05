"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, GripVertical, ImageIcon, Plus, Target, Trash2 } from "lucide-react";

import { QuizImageInput } from "@/components/features/instructor/quiz-image-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { addQuizQuestion, deleteQuizQuestion, updateQuizMeta } from "@/server/actions/quiz";

type QuestionKind = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "IMAGE_CHOICE" | "DRAG_DROP" | "HOTSPOT";
type OptionDraft = { label: string; isCorrect: boolean; imageUrl: string; imageAlt: string; targetId: string };
type TargetDraft = { id: string; label: string };
type Hotspot = { x: number; y: number; radius: number };

interface QuizEditorProps {
  lessonId: string;
  lessonTitle: string;
  returnHref: string;
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
      imageUrl: string | null;
      options: Array<{ id: string; label: string; isCorrect: boolean; imageUrl: string | null; targetId: string | null }>;
    }>;
  } | null;
}

interface Feedback { success: boolean; message: string }

const KIND_LABELS: Record<QuestionKind, string> = {
  SINGLE_CHOICE: "Choix unique",
  MULTIPLE_CHOICE: "Choix multiples",
  TRUE_FALSE: "Vrai / Faux",
  IMAGE_CHOICE: "Choix / comparaison d’images",
  DRAG_DROP: "Glisser-déposer par catégorie",
  HOTSPOT: "Zone cliquable sur une image",
};

function blankOptions(): OptionDraft[] {
  return [
    { label: "", isCorrect: true, imageUrl: "", imageAlt: "", targetId: "target-1" },
    { label: "", isCorrect: false, imageUrl: "", imageAlt: "", targetId: "target-2" },
  ];
}

function HotspotEditor({ imageUrl, value, onChange }: { imageUrl: string; value: Hotspot | null; onChange: (value: Hotspot) => void }) {
  function choose(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    onChange({
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
      radius: value?.radius ?? 10,
    });
  }
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Zone correcte</p>
      <div
        className="relative cursor-crosshair overflow-hidden rounded-lg border bg-muted"
        onPointerDown={choose}
        role="button"
        tabIndex={0}
        aria-label="Définir le centre de la zone correcte"
        onKeyDown={(event) => {
          if (!value || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
          event.preventDefault();
          onChange({
            ...value,
            x: Math.max(0, Math.min(100, value.x + (event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0))),
            y: Math.max(0, Math.min(100, value.y + (event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0))),
          });
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Image à annoter" className="max-h-[480px] w-full object-contain" draggable={false} />
        {value ? (
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-[color:var(--brand-secondary)]/35 shadow-[0_0_0_2px_var(--brand-secondary)]"
            style={{ left: `${value.x}%`, top: `${value.y}%`, width: `${value.radius * 2}%`, aspectRatio: "1" }}
          />
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor="hotspot-radius" className="text-xs text-muted-foreground">Tolérance</label>
        <input id="hotspot-radius" type="range" min={2} max={30} value={value?.radius ?? 10} disabled={!value} onChange={(event) => value && onChange({ ...value, radius: Number(event.target.value) })} className="max-w-xs flex-1" />
        <span className="w-10 text-right text-xs tabular-nums">{value?.radius ?? 10} %</span>
      </div>
      <p className="text-xs text-muted-foreground">Cliquez au centre de la bonne zone, puis ajustez la tolérance.</p>
    </div>
  );
}

export function QuizEditor({ lessonId, lessonTitle, returnHref, quiz }: QuizEditorProps) {
  const router = useRouter();
  const questionFormRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [kind, setKind] = useState<QuestionKind>("SINGLE_CHOICE");
  const [options, setOptions] = useState<OptionDraft[]>(blankOptions);
  const [targets, setTargets] = useState<TargetDraft[]>([
    { id: "target-1", label: "Catégorie 1" },
    { id: "target-2", label: "Catégorie 2" },
  ]);
  const [questionImage, setQuestionImage] = useState("");
  const [hotspot, setHotspot] = useState<Hotspot | null>(null);

  function showResult(result: { success: boolean; message?: string; fieldErrors?: Record<string, string[]> }) {
    const validationMessage = Object.values(result.fieldErrors ?? {}).flat().filter(Boolean).join(" ");
    setFeedback({ success: result.success, message: result.message || validationMessage || (result.success ? "Modification enregistrée." : "Vérifiez les champs du formulaire.") });
  }

  function resetQuestion() {
    questionFormRef.current?.reset();
    setKind("SINGLE_CHOICE");
    setOptions(blankOptions());
    setTargets([{ id: "target-1", label: "Catégorie 1" }, { id: "target-2", label: "Catégorie 2" }]);
    setQuestionImage("");
    setHotspot(null);
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
      imageUrl: questionImage,
      imageAlt: formData.get("imageAlt") ?? "",
      interactionConfig: kind === "DRAG_DROP" ? { targets } : undefined,
      answerConfig: kind === "HOTSPOT" ? hotspot ?? undefined : undefined,
      options: kind === "HOTSPOT" ? [] : options,
    };
    startTransition(async () => {
      const result = await addQuizQuestion(lessonId, payload);
      showResult(result);
      if (result.success) {
        resetQuestion();
        router.refresh();
      }
    });
  }

  function changeKind(nextKind: QuestionKind) {
    setKind(nextKind);
    setHotspot(null);
    setOptions(nextKind === "TRUE_FALSE" ? [
      { label: "Vrai", isCorrect: true, imageUrl: "", imageAlt: "", targetId: "" },
      { label: "Faux", isCorrect: false, imageUrl: "", imageAlt: "", targetId: "" },
    ] : blankOptions());
  }

  function setCorrect(index: number, checked: boolean) {
    setOptions((current) => current.map((option, optionIndex) => ({
      ...option,
      isCorrect: kind === "MULTIPLE_CHOICE" ? (optionIndex === index ? checked : option.isCorrect) : optionIndex === index,
    })));
  }

  function updateOption(index: number, changes: Partial<OptionDraft>) {
    setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? { ...option, ...changes } : option));
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Configuration du quiz</h3>
        <p className="text-sm text-muted-foreground">Créez des QCM classiques ou des activités visuelles accessibles sur ordinateur, tablette et mobile.</p>
      </div>
      {feedback ? <Alert variant={feedback.success ? "success" : "destructive"}><AlertDescription>{feedback.message}</AlertDescription></Alert> : null}

      <form action={handleMetaSubmit} className="space-y-4" aria-label="Paramètres du quiz">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="quiz-title" label="Titre du quiz" required><Input id="quiz-title" name="title" defaultValue={quiz?.title ?? lessonTitle} minLength={2} maxLength={120} required /></FormField>
          <FormField id="passing-score" label="Score minimum (%)" required><Input id="passing-score" name="passingScore" type="number" defaultValue={quiz?.passingScore ?? 70} min={0} max={100} required /></FormField>
        </div>
        <FormField id="quiz-description" label="Description et consignes"><Textarea id="quiz-description" name="description" defaultValue={quiz?.description ?? ""} rows={3} maxLength={1000} /></FormField>
        <FormField id="max-attempts" label="Nombre maximal de tentatives" hint="Laissez vide pour autoriser un nombre illimité de tentatives."><Input id="max-attempts" name="maxAttempts" type="number" defaultValue={quiz?.maxAttempts ?? ""} min={1} max={50} className="sm:max-w-xs" /></FormField>
        <div className="flex justify-end"><Button type="submit" disabled={pending}>Enregistrer les paramètres</Button></div>
      </form>

      <section className="space-y-4" aria-labelledby="quiz-questions-title">
        <div><h3 id="quiz-questions-title" className="font-semibold">Questions ({quiz?.questions.length ?? 0})</h3><p className="text-sm text-muted-foreground">Les coches vertes et les catégories indiquent la correction enregistrée.</p></div>
        {!quiz || quiz.questions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center"><p className="font-medium">Aucune question pour le moment</p><p className="mt-1 text-sm text-muted-foreground">Utilisez le formulaire ci-dessous pour créer la première question.</p></div>
        ) : (
          <ol className="space-y-3">
            {quiz.questions.map((question, questionIndex) => (
              <li key={question.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>Question {questionIndex + 1}</span><span>·</span><span>{KIND_LABELS[question.kind]}</span><span>·</span><span>{question.points} point{question.points > 1 ? "s" : ""}</span></div>
                    <p className="font-medium text-foreground">{question.prompt}</p>
                    {question.imageUrl ? <p className="flex items-center gap-1 text-xs text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" /> Image principale ajoutée</p> : null}
                    {question.kind !== "HOTSPOT" ? (
                      <ul className="grid gap-1 text-sm sm:grid-cols-2">{question.options.map((option) => <li key={option.id} className="flex items-center gap-2 text-muted-foreground">{option.isCorrect ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--brand-success)]" aria-label="Réponse correcte" /> : <span className="h-4 w-4 shrink-0 rounded-full border border-border" aria-hidden />}<span>{option.label}{option.targetId ? ` → ${option.targetId}` : ""}</span>{option.imageUrl ? <ImageIcon className="h-3.5 w-3.5" aria-label="Avec image" /> : null}</li>)}</ul>
                    ) : <p className="flex items-center gap-1 text-sm text-muted-foreground"><Target className="h-4 w-4" /> Zone correcte enregistrée</p>}
                    {question.explanation ? <p className="text-xs text-muted-foreground">Explication : {question.explanation}</p> : null}
                  </div>
                  <Button type="button" variant="ghost" size="icon" disabled={pending} aria-label={`Supprimer la question ${questionIndex + 1}`} onClick={() => {
                    if (!window.confirm(`Supprimer la question ${questionIndex + 1} ?`)) return;
                    startTransition(async () => { const result = await deleteQuizQuestion(question.id); showResult(result); if (result.success) router.refresh(); });
                  }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <form ref={questionFormRef} action={handleQuestionSubmit} className="space-y-5 rounded-lg border border-border bg-muted/20 p-4" aria-label="Ajouter une question">
        <div><h3 className="font-semibold">Ajouter une question</h3><p className="mt-1 text-xs text-muted-foreground">Pour votre scénario ITE : utilisez « zone cliquable » pour repérer un désordre, « glisser-déposer » pour classer les causes et « choix d’images » pour comparer les solutions.</p></div>
        <FormField id="question-prompt" label="Énoncé" required><Textarea id="question-prompt" name="prompt" rows={3} minLength={5} maxLength={500} required /></FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="question-kind" label="Type de question"><Select id="question-kind" value={kind} onChange={(event) => changeKind(event.target.value as QuestionKind)}>{Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></FormField>
          <FormField id="question-points" label="Points"><Input id="question-points" name="points" type="number" defaultValue={1} min={1} max={10} /></FormField>
        </div>

        {kind !== "TRUE_FALSE" ? (
          <fieldset className="space-y-3 rounded-md border border-border bg-card p-3">
            <legend className="px-1 text-sm font-medium">Image principale {kind === "HOTSPOT" ? "(obligatoire)" : "(optionnelle)"}</legend>
            <QuizImageInput value={questionImage} onChange={(url) => { setQuestionImage(url); if (!url) setHotspot(null); }} disabled={pending} label="Téléverser l’image de la question" />
            {questionImage ? <FormField id="question-image-alt" label="Description de l’image"><Input id="question-image-alt" name="imageAlt" maxLength={300} placeholder="Ex. Façade présentant un décollement de l’ITE" required /></FormField> : null}
          </fieldset>
        ) : null}

        {kind === "HOTSPOT" ? (
          questionImage ? <HotspotEditor imageUrl={questionImage} value={hotspot} onChange={setHotspot} /> : <Alert variant="info"><AlertDescription>Ajoutez d’abord l’image, puis cliquez dessus pour définir la zone correcte.</AlertDescription></Alert>
        ) : (
          <>
            {kind === "DRAG_DROP" ? (
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Catégories de dépôt</legend>
                {targets.map((target, index) => (
                  <div key={target.id} className="flex items-center gap-2"><Target className="h-4 w-4 text-muted-foreground" /><Input value={target.label} onChange={(event) => setTargets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} maxLength={160} required aria-label={`Catégorie ${index + 1}`} />
                    {targets.length > 2 ? <Button type="button" variant="ghost" size="icon" aria-label={`Retirer la catégorie ${index + 1}`} onClick={() => { const removedId = target.id; const nextTarget = targets.find((item) => item.id !== removedId)?.id ?? ""; setTargets((current) => current.filter((item) => item.id !== removedId)); setOptions((current) => current.map((option) => option.targetId === removedId ? { ...option, targetId: nextTarget } : option)); }}><Trash2 className="h-4 w-4" /></Button> : null}
                  </div>
                ))}
                {targets.length < 6 ? <Button type="button" variant="outline" size="sm" onClick={() => { const id = `target-${Date.now()}`; setTargets((current) => [...current, { id, label: `Catégorie ${current.length + 1}` }]); }}><Plus className="h-4 w-4" /> Ajouter une catégorie</Button> : null}
              </fieldset>
            ) : null}

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">{kind === "DRAG_DROP" ? "Cartes à classer" : "Réponses proposées"}</legend>
              <div className={cn("grid gap-3", kind === "IMAGE_CHOICE" && "sm:grid-cols-2")}>
                {options.map((option, index) => (
                  <div key={index} className="space-y-3 rounded-md border border-border bg-card p-3">
                    {kind === "IMAGE_CHOICE" ? <QuizImageInput value={option.imageUrl} onChange={(imageUrl) => updateOption(index, { imageUrl })} compact disabled={pending} label={`Image ${index + 1}`} /> : null}
                    <div className="flex items-center gap-3">
                      {kind === "DRAG_DROP" ? <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Checkbox checked={option.isCorrect} onChange={(event) => setCorrect(index, event.target.checked)} aria-label={`Marquer la réponse ${index + 1} comme correcte`} />}
                      <Input value={option.label} onChange={(event) => updateOption(index, { label: event.target.value })} disabled={kind === "TRUE_FALSE"} required maxLength={300} aria-label={kind === "DRAG_DROP" ? `Carte ${index + 1}` : `Réponse ${index + 1}`} placeholder={kind === "DRAG_DROP" ? `Carte ${index + 1}` : `Réponse ${index + 1}`} />
                      {kind !== "TRUE_FALSE" && options.length > 2 ? <Button type="button" variant="ghost" size="icon" onClick={() => setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index))} aria-label={`Retirer la réponse ${index + 1}`}><Trash2 className="h-4 w-4" /></Button> : null}
                    </div>
                    {kind === "IMAGE_CHOICE" && option.imageUrl ? <Input value={option.imageAlt} onChange={(event) => updateOption(index, { imageAlt: event.target.value })} placeholder="Description de cette image" maxLength={300} required aria-label={`Description de l’image ${index + 1}`} /> : null}
                    {kind === "DRAG_DROP" ? <Select value={option.targetId} onChange={(event) => updateOption(index, { targetId: event.target.value })} aria-label={`Bonne catégorie pour la carte ${index + 1}`}>{targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}</Select> : null}
                  </div>
                ))}
              </div>
              {kind !== "TRUE_FALSE" && options.length < 8 ? <Button type="button" variant="outline" size="sm" onClick={() => setOptions((current) => [...current, { label: "", isCorrect: false, imageUrl: "", imageAlt: "", targetId: targets[0]?.id ?? "" }])}><Plus className="h-4 w-4" /> {kind === "DRAG_DROP" ? "Ajouter une carte" : "Ajouter une réponse"}</Button> : null}
              <p className="text-xs text-muted-foreground">{kind === "DRAG_DROP" ? "Choisissez la bonne catégorie pour chaque carte. L’élève pourra la glisser ou la placer au clic." : kind === "MULTIPLE_CHOICE" ? "Cochez toutes les bonnes réponses." : "Cochez l’unique bonne réponse."}</p>
            </fieldset>
          </>
        )}

        <FormField id="question-explanation" label="Explication (optionnelle)" hint="Affichée à l’élève après sa tentative."><Textarea id="question-explanation" name="explanation" rows={2} maxLength={1000} /></FormField>
        <div className="flex justify-end"><Button type="submit" disabled={pending}><Plus className="h-4 w-4" /> {pending ? "Enregistrement…" : "Ajouter la question"}</Button></div>
      </form>

      <div className="flex justify-end border-t pt-6"><Button type="button" onClick={() => router.push(returnHref)} disabled={pending || !quiz || quiz.questions.length === 0}><CheckCircle2 className="h-4 w-4" /> Valider le quiz et revenir au programme</Button></div>
    </div>
  );
}
