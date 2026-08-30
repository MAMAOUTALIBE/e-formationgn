"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { createLesson } from "@/server/actions/curriculum";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

type LessonCreateResult = ActionResult & { lessonId?: string };

interface LessonCreateFormProps {
  courseId: string;
  sectionId: string;
}

export function LessonCreateForm({ courseId, sectionId }: LessonCreateFormProps) {
  const router = useRouter();
  const action = createLesson.bind(null, sectionId);
  const [state, formAction] = useActionState<LessonCreateResult, FormData>(
    action,
    initialState,
  );

  useEffect(() => {
    if (state.success && state.lessonId) {
      router.push(`/formateur/cours/${courseId}/lecons/${state.lessonId}`);
    }
  }, [courseId, router, state.lessonId, state.success]);

  const errors = state.fieldErrors ?? {};

  return (
    <form
      action={formAction}
      className="grid gap-3 rounded-[10px] border border-dashed border-blue-300 bg-blue-50 p-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end dark:border-blue-800 dark:bg-blue-950/30"
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
