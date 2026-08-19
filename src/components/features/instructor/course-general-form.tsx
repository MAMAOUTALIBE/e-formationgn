"use client";

import { useActionState } from "react";

import { FormDraft } from "@/components/ui/form-draft";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { COURSE_LEVEL_LABELS } from "@/lib/format/labels";
import { COURSE_LEVELS } from "@/lib/validators/courses";
import { updateCourseGeneral } from "@/server/actions/instructor";
import type { ActionResult } from "@/server/actions/auth";

import { ThumbnailUploader } from "./thumbnail-uploader";
import { useAdvanceOnSuccess } from "./use-advance-on-success";

const initialState: ActionResult = { success: false };

interface CourseGeneralFormProps {
  courseId: string;
  defaults: {
    title: string;
    subtitle: string;
    description: string;
    categoryId: string;
    level: (typeof COURSE_LEVELS)[number];
    thumbnailUrl: string;
  };
  categories: Array<{ id: string; name: string }>;
  /** Étape suivante de l'assistant — auto-avance après enregistrement. */
  nextHref?: string;
}

export function CourseGeneralForm({
  courseId,
  defaults,
  categories,
  nextHref,
}: CourseGeneralFormProps) {
  const action = updateCourseGeneral.bind(null, courseId);
  const [state, formAction] = useActionState(action, initialState);
  const errors = state.fieldErrors ?? {};
  useAdvanceOnSuccess(state.success, nextHref);

  return (
    <form action={formAction} className="space-y-6">
      {/* Brouillon local : la saisie survit à un échec d'enregistrement,
          à un rafraîchissement ou à un onglet fermé. */}
      <FormDraft storageKey={`cours-general:${courseId}`} clearWhen={state.success} signal={state} />

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

      <FormField id="title" label="Titre" required error={errors.title?.[0]}>
        <Input id="title" name="title" defaultValue={defaults.title} required maxLength={120} />
      </FormField>

      <FormField
        id="subtitle"
        label="Sous-titre"
        error={errors.subtitle?.[0]}
        hint="Une accroche brève qui apparaîtra sous le titre."
      >
        <Input
          id="subtitle"
          name="subtitle"
          defaultValue={defaults.subtitle}
          maxLength={200}
        />
      </FormField>

      <FormField
        id="description"
        label="Description"
        required
        error={errors.description?.[0]}
        hint="Présentez la formation, son contenu et ses bénéfices. Markdown léger supporté."
      >
        <Textarea
          id="description"
          name="description"
          rows={10}
          defaultValue={defaults.description}
          required
          minLength={50}
          maxLength={8000}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="categoryId" label="Catégorie" required error={errors.categoryId?.[0]}>
          <Select id="categoryId" name="categoryId" defaultValue={defaults.categoryId} required>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField id="level" label="Niveau" required error={errors.level?.[0]}>
          <Select id="level" name="level" defaultValue={defaults.level} required>
            {COURSE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {COURSE_LEVEL_LABELS[level]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField
        id="thumbnailUrl"
        label="Photo de couverture"
        error={errors.thumbnailUrl?.[0]}
        hint="Format 16:9, idéalement ≥ 1280×720. Sert aussi de visuel sur la fiche de la formation."
      >
        <ThumbnailUploader
          name="thumbnailUrl"
          defaultValue={defaults.thumbnailUrl}
        />
      </FormField>

      <div className="flex justify-end">
        <SubmitButton>
          {nextHref ? "Enregistrer et continuer" : "Enregistrer"}
        </SubmitButton>
      </div>
    </form>
  );
}
