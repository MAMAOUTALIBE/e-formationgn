"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { createQuestion } from "@/server/actions/qa";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

async function submit(_prev: ActionResult, formData: FormData) {
  return createQuestion(formData);
}

interface AskQuestionFormProps {
  courseId: string;
}

export function AskQuestionForm({ courseId }: AskQuestionFormProps) {
  const [state, formAction] = useActionState(submit, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />

      {state.message ? (
        <Alert variant={state.success ? "success" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <FormField id="title" label="Titre de la question" required error={errors.title?.[0]}>
        <Input
          id="title"
          name="title"
          required
          minLength={5}
          maxLength={160}
          placeholder="En quelques mots…"
        />
      </FormField>

      <FormField id="body" label="Détail de votre question" required error={errors.body?.[0]}>
        <Textarea
          id="body"
          name="body"
          rows={5}
          required
          minLength={10}
          maxLength={4000}
          placeholder="Donnez le contexte, ce que vous avez essayé, etc."
        />
      </FormField>

      <SubmitButton>Publier la question</SubmitButton>
    </form>
  );
}
