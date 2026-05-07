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
}

export function ModerationForm({ courseId }: ModerationFormProps) {
  const [state, formAction] = useActionState(submit, initialState);
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />

      {state.message ? (
        <Alert variant={state.success ? "success" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={action === "approve" ? "default" : "outline"}
          onClick={() => setAction("approve")}
        >
          Approuver
        </Button>
        <Button
          type="button"
          variant={action === "reject" ? "destructive" : "outline"}
          onClick={() => setAction("reject")}
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
            rows={4}
            required
            minLength={6}
            maxLength={500}
            placeholder="Expliquez clairement au formateur ce qu'il doit corriger."
          />
        </FormField>
      ) : null}

      <SubmitButton>
        {action === "approve" ? "Publier le cours" : "Envoyer le refus"}
      </SubmitButton>
    </form>
  );
}
