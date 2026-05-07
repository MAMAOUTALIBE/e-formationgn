"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { updateCourseSeo } from "@/server/actions/instructor";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

interface CourseSeoFormProps {
  courseId: string;
  defaults: {
    metaTitle: string;
    metaDescription: string;
    whatYouWillLearn: string;
    requirements: string;
    targetAudience: string;
  };
}

export function CourseSeoForm({ courseId, defaults }: CourseSeoFormProps) {
  const action = updateCourseSeo.bind(null, courseId);
  const [state, formAction] = useActionState(action, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
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

      <FormField
        id="metaTitle"
        label="Titre SEO"
        error={errors.metaTitle?.[0]}
        hint="Apparaît dans les résultats de recherche. 60 caractères max recommandés."
      >
        <Input
          id="metaTitle"
          name="metaTitle"
          maxLength={120}
          defaultValue={defaults.metaTitle}
        />
      </FormField>

      <FormField
        id="metaDescription"
        label="Description SEO"
        error={errors.metaDescription?.[0]}
        hint="160 caractères max recommandés."
      >
        <Textarea
          id="metaDescription"
          name="metaDescription"
          rows={3}
          maxLength={280}
          defaultValue={defaults.metaDescription}
        />
      </FormField>

      <FormField
        id="whatYouWillLearn"
        label="Ce que les élèves vont apprendre"
        error={errors.whatYouWillLearn?.[0]}
        hint="Une bénéfice par ligne (jusqu'à 20)."
      >
        <Textarea
          id="whatYouWillLearn"
          name="whatYouWillLearn"
          rows={6}
          defaultValue={defaults.whatYouWillLearn}
        />
      </FormField>

      <FormField
        id="requirements"
        label="Pré-requis"
        error={errors.requirements?.[0]}
        hint="Un pré-requis par ligne."
      >
        <Textarea
          id="requirements"
          name="requirements"
          rows={4}
          defaultValue={defaults.requirements}
        />
      </FormField>

      <FormField
        id="targetAudience"
        label="À qui s'adresse ce cours"
        error={errors.targetAudience?.[0]}
        hint="Un profil par ligne."
      >
        <Textarea
          id="targetAudience"
          name="targetAudience"
          rows={4}
          defaultValue={defaults.targetAudience}
        />
      </FormField>

      <div className="flex justify-end">
        <SubmitButton>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
