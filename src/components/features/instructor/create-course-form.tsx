"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createCourse } from "@/server/actions/instructor";
import type { ActionResult } from "@/server/actions/auth";

import { ThumbnailUploader } from "./thumbnail-uploader";

const initialState: ActionResult = { success: false };

interface CreateCourseFormProps {
  categories: Array<{ id: string; name: string }>;
}

export function CreateCourseForm({ categories }: CreateCourseFormProps) {
  const [state, formAction, pending] = useActionState(createCourse, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {state.message && !state.success ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <FormField
        id="title"
        label="Titre de la formation"
        required
        error={errors.title?.[0]}
        hint="Vous pourrez l'affiner par la suite."
      >
        <Input
          id="title"
          name="title"
          required
          minLength={5}
          maxLength={120}
          disabled={pending}
          placeholder="Ex : React pour les développeurs Vue.js"
        />
      </FormField>

      <FormField
        id="categoryId"
        label="Catégorie"
        required
        error={errors.categoryId?.[0]}
      >
        <Select id="categoryId" name="categoryId" required disabled={pending}>
          <option value="">Sélectionnez une catégorie…</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        id="thumbnailUrl"
        label="Photo de couverture (optionnel)"
        error={errors.thumbnailUrl?.[0]}
        hint="Vous pouvez la définir plus tard depuis l'onglet « Général » de la formation. Sera demandée avant publication."
      >
        <ThumbnailUploader name="thumbnailUrl" disabled={pending} optional />
      </FormField>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Création…" : "Créer le brouillon"}
      </Button>

      <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        💡 Après la création, vous pourrez ajouter description, programme, leçons
        et <strong>vidéos</strong> depuis l&apos;onglet « Programme » de la formation,
        puis cliquer sur chaque leçon pour téléverser sa vidéo.
      </p>
    </form>
  );
}
