"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import { ArrowLeft, CheckCircle2, Eye } from "lucide-react";

import { FormDraft } from "@/components/ui/form-draft";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { suggestSeoForCourse } from "@/server/actions/ai-seo";
import { updateCourseSeo } from "@/server/actions/instructor";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

interface CourseSeoFormProps {
  courseId: string;
  previewHref?: string;
  returnHref: string;
  defaults: {
    metaTitle: string;
    metaDescription: string;
    whatYouWillLearn: string;
    requirements: string;
    targetAudience: string;
  };
  /** Si vrai, le bouton « Suggestions IA » est affiché. */
  aiAvailable: boolean;
}

export function CourseSeoForm({
  courseId,
  previewHref,
  returnHref,
  defaults,
  aiAvailable,
}: CourseSeoFormProps) {
  const action = updateCourseSeo.bind(null, courseId);
  const [state, formAction] = useActionState(action, initialState);
  const errors = state.fieldErrors ?? {};

  const metaTitleRef = useRef<HTMLInputElement>(null);
  const metaDescRef = useRef<HTMLTextAreaElement>(null);
  const whatYouWillLearnRef = useRef<HTMLTextAreaElement>(null);

  const [aiPending, startAi] = useTransition();
  const [aiNotice, setAiNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  function handleAiSuggest() {
    setAiNotice(null);
    startAi(async () => {
      const result = await suggestSeoForCourse(courseId);
      if (!result.ok || !result.suggestion) {
        setAiNotice({
          kind: "error",
          message: result.message ?? "Échec de la génération.",
        });
        return;
      }
      // Remplit les champs côté client (l'utilisateur peut éditer puis
      // « Enregistrer » pour persister).
      if (metaTitleRef.current) {
        metaTitleRef.current.value = result.suggestion.metaTitle;
      }
      if (metaDescRef.current) {
        metaDescRef.current.value = result.suggestion.metaDescription;
      }
      if (whatYouWillLearnRef.current) {
        whatYouWillLearnRef.current.value =
          result.suggestion.whatYouWillLearn.join("\n");
      }
      setAiNotice({
        kind: "success",
        message:
          "Suggestions générées. Relisez et ajustez avant d'enregistrer.",
      });
    });
  }

  return (
    <form action={formAction} className="space-y-6">
      {/* Brouillon local : la saisie survit à un échec d'enregistrement,
          à un rafraîchissement ou à un onglet fermé. */}
      <FormDraft storageKey={`cours-seo:${courseId}`} clearWhen={state.success} signal={state} />

      {aiAvailable ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              Suggestions automatiques
            </p>
            <p className="text-xs text-muted-foreground">
              Génère des champs SEO à partir du titre et de la description de la formation.
              5 utilisations / heure.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleAiSuggest}
            disabled={aiPending}
          >
            {aiPending ? "Génération…" : "Générer avec l'IA"}
          </Button>
        </div>
      ) : null}

      {aiNotice ? (
        <Alert variant={aiNotice.kind === "success" ? "success" : "destructive"}>
          <AlertDescription>{aiNotice.message}</AlertDescription>
        </Alert>
      ) : null}

      {state.success ? (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          <AlertDescription>
            Votre formation a été enregistrée avec succès.
          </AlertDescription>
        </Alert>
      ) : null}
      {state.message && !state.success ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <FormField
        id="metaTitle"
        label="Titre SEO"
        error={errors.metaTitle?.[0]}
        hint="Apparaît dans les résultats de recherche. 60 caractères max recommandés."
      >
        <Input
          ref={metaTitleRef}
          id="metaTitle"
          name="metaTitle"
          maxLength={120}
          defaultValue={defaults.metaTitle}
        />
      </FormField>

      <FormField
        id="metaDescription"
        label="Description SEO"
        error={errors.metaDescription?.[0]}
        hint="160 caractères max recommandés."
      >
        <Textarea
          ref={metaDescRef}
          id="metaDescription"
          name="metaDescription"
          rows={3}
          maxLength={280}
          defaultValue={defaults.metaDescription}
        />
      </FormField>

      <FormField
        id="whatYouWillLearn"
        label="Ce que les élèves vont apprendre"
        error={errors.whatYouWillLearn?.[0]}
        hint="Une bénéfice par ligne (jusqu'à 20)."
      >
        <Textarea
          ref={whatYouWillLearnRef}
          id="whatYouWillLearn"
          name="whatYouWillLearn"
          rows={6}
          defaultValue={defaults.whatYouWillLearn}
        />
      </FormField>

      <FormField
        id="requirements"
        label="Pré-requis"
        error={errors.requirements?.[0]}
        hint="Un pré-requis par ligne."
      >
        <Textarea
          id="requirements"
          name="requirements"
          rows={4}
          defaultValue={defaults.requirements}
        />
      </FormField>

      <FormField
        id="targetAudience"
        label="À qui s'adresse cette formation"
        error={errors.targetAudience?.[0]}
        hint="Un profil par ligne."
      >
        <Textarea
          id="targetAudience"
          name="targetAudience"
          rows={4}
          defaultValue={defaults.targetAudience}
        />
      </FormField>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {state.success ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={returnHref}>
                <ArrowLeft className="h-4 w-4" />
                Retour au programme
              </Link>
            </Button>
            {previewHref ? (
              <Button asChild variant="secondary">
                <Link href={previewHref} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-4 w-4" />
                  Voir l’aperçu
                </Link>
              </Button>
            ) : null}
          </div>
        ) : <span />}
        <SubmitButton>Enregistrer la formation</SubmitButton>
      </div>
    </form>
  );
}
