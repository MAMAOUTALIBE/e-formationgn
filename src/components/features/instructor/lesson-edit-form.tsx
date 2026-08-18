"use client";

import { useActionState, useState } from "react";

import { FormDraft } from "@/components/ui/form-draft";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { updateLesson } from "@/server/actions/curriculum";
import type { ActionResult } from "@/server/actions/auth";
import type { LessonType } from "@/generated/prisma/enums";

const initialState: ActionResult = { success: false };

interface LessonEditFormProps {
  lessonId: string;
  defaults: {
    title: string;
    type: LessonType;
    description: string;
    textContent: string;
    resourceUrl: string;
    resourceFileName: string;
    isFreePreview: boolean;
  };
}

export function LessonEditForm({ lessonId, defaults }: LessonEditFormProps) {
  const action = updateLesson.bind(null, lessonId);
  const [state, formAction] = useActionState(action, initialState);
  const [type, setType] = useState<LessonType>(defaults.type);

  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {/* Brouillon local : la saisie survit à un échec d'enregistrement,
          à un rafraîchissement ou à un onglet fermé. */}
      <FormDraft storageKey={`lecon:${lessonId}`} clearWhen={state.success} signal={state} />

      {state.success && state.message ? (
        <Alert variant="success">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.message && !state.success ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <FormField id="title" label="Titre" required error={errors.title?.[0]}>
        <Input
          id="title"
          name="title"
          defaultValue={defaults.title}
          required
          minLength={2}
          maxLength={160}
        />
      </FormField>

      <FormField id="type" label="Type de leçon" error={errors.type?.[0]}>
        <Select
          id="type"
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value as LessonType)}
        >
          <option value="VIDEO">Vidéo</option>
          <option value="TEXT">Texte</option>
          <option value="QUIZ">Quiz</option>
          <option value="RESOURCE">Ressource</option>
        </Select>
      </FormField>

      <FormField
        id="description"
        label="Description courte"
        error={errors.description?.[0]}
      >
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaults.description}
          maxLength={500}
        />
      </FormField>

      {type === "TEXT" ? (
        <FormField
          id="textContent"
          label="Contenu de la leçon"
          error={errors.textContent?.[0]}
          hint="Markdown supporté."
        >
          <Textarea
            id="textContent"
            name="textContent"
            rows={12}
            defaultValue={defaults.textContent}
            maxLength={50_000}
          />
        </FormField>
      ) : (
        <input type="hidden" name="textContent" value={defaults.textContent} />
      )}

      {type === "RESOURCE" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="resourceUrl" label="URL de la ressource" error={errors.resourceUrl?.[0]}>
            <Input
              id="resourceUrl"
              name="resourceUrl"
              type="url"
              defaultValue={defaults.resourceUrl}
              placeholder="https://"
            />
          </FormField>
          <FormField
            id="resourceFileName"
            label="Nom de fichier (optionnel)"
            error={errors.resourceFileName?.[0]}
          >
            <Input
              id="resourceFileName"
              name="resourceFileName"
              defaultValue={defaults.resourceFileName}
              maxLength={160}
              placeholder="cheatsheet.pdf"
            />
          </FormField>
        </div>
      ) : (
        <>
          <input type="hidden" name="resourceUrl" value={defaults.resourceUrl} />
          <input
            type="hidden"
            name="resourceFileName"
            value={defaults.resourceFileName}
          />
        </>
      )}

      <label className="flex items-center gap-2 text-sm text-foreground">
        <Checkbox name="isFreePreview" defaultChecked={defaults.isFreePreview} />
        <span>
          Aperçu gratuit{" "}
          <span className="text-xs text-muted-foreground">
            (visible sans achat sur la page du cours)
          </span>
        </span>
      </label>

      <div className="flex justify-end">
        <SubmitButton>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
