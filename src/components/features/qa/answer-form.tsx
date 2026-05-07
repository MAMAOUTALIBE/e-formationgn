"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { answerQuestion } from "@/server/actions/qa";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

async function submit(_prev: ActionResult, formData: FormData) {
  return answerQuestion(formData);
}

interface AnswerFormProps {
  questionId: string;
}

export function AnswerForm({ questionId }: AnswerFormProps) {
  const [state, formAction] = useActionState(submit, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="questionId" value={questionId} />

      {state.message ? (
        <Alert variant={state.success ? "success" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <Textarea
        name="body"
        rows={3}
        required
        minLength={2}
        maxLength={4000}
        placeholder="Votre réponse…"
        aria-invalid={Boolean(errors.body)}
      />

      <div className="flex justify-end">
        <SubmitButton size="sm">Répondre</SubmitButton>
      </div>
    </form>
  );
}
