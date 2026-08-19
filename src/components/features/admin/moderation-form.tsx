"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { CourseStatusBadge } from "@/components/features/instructor/course-status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import type { CourseStatus } from "@/generated/prisma/enums";
import { transitionCourseStatus } from "@/server/actions/admin-courses";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };
const EDITABLE_STATUSES = [
  ["DRAFT", "Brouillon"],
  ["PENDING_REVIEW", "En attente de révision"],
  ["PUBLISHED", "Publié"],
  ["REJECTED", "Refusé"],
] as const satisfies ReadonlyArray<readonly [CourseStatus, string]>;

interface ModerationFormProps {
  courseId: string;
  currentStatus: CourseStatus;
  publishable?: boolean;
}

function TransitionSubmitButton({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={disabled || pending} aria-busy={pending}>
      {pending ? (
        <>
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Traitement…
        </>
      ) : label}
    </Button>
  );
}

export function ModerationForm({
  courseId,
  currentStatus,
  publishable = true,
}: ModerationFormProps) {
  const router = useRouter();
  const action = transitionCourseStatus.bind(null, courseId);
  const [state, formAction] = useActionState(action, initialState);
  const [editing, setEditing] = useState(currentStatus === "PENDING_REVIEW");
  const [targetStatus, setTargetStatus] = useState<CourseStatus>(
    currentStatus === "PENDING_REVIEW" ? "PUBLISHED" : currentStatus,
  );
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const errors = state.fieldErrors ?? {};
  const rejecting = targetStatus === "REJECTED";
  const publicationBlocked = targetStatus === "PUBLISHED" && !publishable;

  useEffect(() => {
    if (!state.success) return;
    const displayTimer = window.setTimeout(() => {
      setEditing(false);
      setConfirmation(state.message ?? "Statut mis à jour avec succès.");
      router.refresh();
    }, 0);
    const confirmationTimer = window.setTimeout(() => setConfirmation(null), 3_600);
    return () => {
      window.clearTimeout(displayTimer);
      window.clearTimeout(confirmationTimer);
    };
  }, [router, state]);

  const confirmationAlert = confirmation ? (
    <Alert variant="success" className="animate-in fade-in slide-in-from-bottom-1 duration-300">
      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      <AlertDescription aria-live="polite">{confirmation}</AlertDescription>
    </Alert>
  ) : null;

  if (!editing) {
    return (
      <div className="space-y-3">
        {confirmationAlert}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Statut actuel :</span>
            <CourseStatusBadge status={currentStatus} />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setTargetStatus(currentStatus === "ARCHIVED" ? "DRAFT" : currentStatus);
              setEditing(true);
            }}
          >
            Modifier le statut
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="animate-in space-y-3 fade-in slide-in-from-top-1 duration-200">
      {confirmationAlert}
      {state.message && !state.success ? (
        <Alert variant="destructive" className="py-2">
          <AlertDescription aria-live="assertive" className="text-xs">{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {currentStatus === "PENDING_REVIEW" ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Décision rapide">
          <Button
            type="button"
            size="sm"
            variant={targetStatus === "PUBLISHED" ? "default" : "outline"}
            aria-pressed={targetStatus === "PUBLISHED"}
            onClick={() => setTargetStatus("PUBLISHED")}
          >
            Approuver
          </Button>
          <Button
            type="button"
            size="sm"
            variant={targetStatus === "REJECTED" ? "destructive" : "outline"}
            aria-pressed={targetStatus === "REJECTED"}
            onClick={() => setTargetStatus("REJECTED")}
          >
            Refuser
          </Button>
        </div>
      ) : (
        <FormField id="course-status" label="Nouveau statut">
          <select
            id="course-status"
            value={targetStatus}
            onChange={(event) => setTargetStatus(event.target.value as CourseStatus)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {EDITABLE_STATUSES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </FormField>
      )}

      <input type="hidden" name="status" value={targetStatus} />

      {rejecting ? (
        <FormField id="reason" label="Motif du refus" required error={errors.reason?.[0]}>
          <Textarea
            id="reason"
            name="reason"
            rows={3}
            required
            minLength={10}
            maxLength={500}
            placeholder="Expliquez clairement au formateur ce qu’il doit corriger."
            className="min-h-20"
          />
        </FormField>
      ) : null}

      {publicationBlocked ? (
        <p role="status" className="text-xs text-destructive">
          Critères qualité non remplis (voir la checklist) — publication impossible.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <TransitionSubmitButton
          disabled={publicationBlocked || targetStatus === currentStatus}
          label={rejecting ? "Confirmer le refus" : "Enregistrer le statut"}
        />
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
