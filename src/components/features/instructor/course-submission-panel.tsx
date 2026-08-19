"use client";

import { useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/features/instructor/confirm-action";
import {
  submitCourseForReview,
  unpublishCourse,
  withdrawCourseSubmission,
} from "@/server/actions/instructor";
import type { CourseStatus } from "@/generated/prisma/enums";
import { useState } from "react";

interface CourseSubmissionPanelProps {
  courseId: string;
  status: CourseStatus;
}

export function CourseSubmissionPanel({ courseId, status }: CourseSubmissionPanelProps) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(
    null,
  );

  function handleSubmit() {
    setFeedback(null);
    startTransition(async () => {
      const result = await submitCourseForReview(courseId);
      setFeedback({
        kind: result.success ? "ok" : "error",
        message:
          result.message ??
          (result.success
            ? "Formation soumise."
            : "Erreur lors de la soumission."),
      });
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {status === "DRAFT" || status === "REJECTED" ? (
          <Button type="button" onClick={handleSubmit} disabled={pending}>
            {pending ? "Soumission…" : "Soumettre à la modération"}
          </Button>
        ) : null}

        {status === "PENDING_REVIEW" ? (
          <ConfirmAction
            variant="outline"
            message="Annuler la soumission ? La formation repassera en brouillon."
            onConfirm={async () => {
              const result = await withdrawCourseSubmission(courseId);
              setFeedback({
                kind: result.success ? "ok" : "error",
                message:
                  result.message ??
                  (result.success ? "Soumission annulée." : "Erreur."),
              });
            }}
            pendingLabel="Annulation…"
          >
            Annuler la soumission
          </ConfirmAction>
        ) : null}

        {status === "PUBLISHED" ? (
          <ConfirmAction
            variant="outline"
            message="Archiver cette formation ? Elle ne sera plus visible publiquement (mais les élèves inscrits y conserveront l'accès)."
            onConfirm={async () => {
              const result = await unpublishCourse(courseId);
              setFeedback({
                kind: result.success ? "ok" : "error",
                message: result.message ?? "Erreur.",
              });
            }}
            pendingLabel="Archivage…"
          >
            Archiver la formation
          </ConfirmAction>
        ) : null}
      </div>

      {feedback ? (
        <Alert variant={feedback.kind === "ok" ? "success" : "destructive"}>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
