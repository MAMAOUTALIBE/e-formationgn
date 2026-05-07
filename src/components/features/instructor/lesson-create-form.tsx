"use client";

import { useActionState, useEffect, useRef } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { createLesson } from "@/server/actions/curriculum";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

interface LessonCreateFormProps {
  sectionId: string;
}

export function LessonCreateForm({ sectionId }: LessonCreateFormProps) {
  const action = createLesson.bind(null, sectionId);
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  const errors = state.fieldErrors ?? {};

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-3 rounded-md border border-dashed border-border p-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"
    >
      <FormField id={`lesson-title-${sectionId}`} label="Nouvelle leçon" error={errors.title?.[0]}>
        <Input
          id={`lesson-title-${sectionId}`}
          name="title"
          required
          minLength={2}
          maxLength={160}
          placeholder="Titre de la leçon"
        />
      </FormField>
      <FormField id={`lesson-type-${sectionId}`} label="Type" error={errors.type?.[0]}>
        <Select id={`lesson-type-${sectionId}`} name="type" defaultValue="VIDEO">
          <option value="VIDEO">Vidéo</option>
          <option value="TEXT">Texte</option>
          <option value="QUIZ">Quiz</option>
          <option value="RESOURCE">Ressource</option>
        </Select>
      </FormField>
      <SubmitButton pendingLabel="Création…">Ajouter</SubmitButton>

      {state.message && !state.success ? (
        <div className="sm:col-span-3">
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        </div>
      ) : null}
    </form>
  );
}
