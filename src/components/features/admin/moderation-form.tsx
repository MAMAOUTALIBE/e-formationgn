"use client";

import { useActionState, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { moderateCourse } from "@/server/actions/admin";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

async function submit(_prev: ActionResult, formData: FormData) {
  return moderateCourse(formData);
}

interface ModerationFormProps {
  courseId: string;
  /** Tous les critères qualité sont remplis (sinon « Publier » est bloqué). */
  publishable?: boolean;
}

export function ModerationForm({ courseId, publishable = true }: ModerationFormProps) {
  const [state, formAction] = useActionState(submit, initialState);
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const errors = state.fieldErrors ?? {};
  const blockApprove = action === "approve" && !publishable;

  return (
    <form action={formAction} className="space-y-2.5">
      <input type="hidden" name="courseId" value={courseId} />

      {state.message ? (
        <Alert variant={state.success ? "success" : "destructive"} className="py-2">
          <AlertDescription aria-live="polite" className="text-xs">{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Décision de modération">
        <Button
          type="button"
          size="sm"
          variant={action === "approve" ? "default" : "outline"}
          aria-pressed={action === "approve"}
          onClick={() => setAction("approve")}
          className="h-9"
        >
          Approuver
        </Button>
        <Button
          type="button"
          size="sm"
          variant={action === "reject" ? "destructive" : "outline"}
          aria-pressed={action === "reject"}
          onClick={() => setAction("reject")}
          className="h-9"
        >
          Refuser
        </Button>
      </div>

      <input type="hidden" name="action" value={action} />

      {action === "reject" ? (
        <FormField
          id="reason"
          label="Motif du refus"
          required
          error={errors.reason?.[0]}
        >
          <Textarea
            id="reason"
            name="reason"
            rows={3}
            required
            minLength={6}
            maxLength={500}
            placeholder="Expliquez clairement au formateur ce qu'il doit corriger."
            className="min-h-20"
          />
        </FormField>
      ) : null}

      {blockApprove ? (
        <p role="status" className="text-xs text-[color:var(--brand-danger)]">
          Critères qualité non remplis (voir la checklist) — publication
          impossible.
        </p>
      ) : null}

      <SubmitButton disabled={blockApprove} size="sm" pendingLabel="Envoi…">
        {action === "approve" ? "Publier le cours" : "Envoyer le refus"}
      </SubmitButton>
    </form>
  );
}
