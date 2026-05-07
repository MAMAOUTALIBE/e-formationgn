"use client";

import { useActionState, useEffect, useRef } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { createSection } from "@/server/actions/curriculum";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

interface SectionCreateFormProps {
  courseId: string;
}

export function SectionCreateForm({ courseId }: SectionCreateFormProps) {
  const action = createSection.bind(null, courseId);
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state]);

  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <FormField
        id="new-section-title"
        label="Nouvelle section"
        error={errors.title?.[0]}
        hint="Ex : « Introduction », « Mise en pratique »…"
      >
        <Input
          id="new-section-title"
          name="title"
          required
          minLength={2}
          maxLength={120}
          placeholder="Titre de la section"
        />
      </FormField>
      <SubmitButton pendingLabel="Création…">Ajouter</SubmitButton>

      {state.message && !state.success ? (
        <div className="sm:col-span-2">
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        </div>
      ) : null}
    </form>
  );
}
