"use client";

// Formulaire de création / modification d'une formation (programme).

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import {
  createProgram,
  updateProgram,
  type ProgramActionResult,
} from "@/server/actions/admin-programs";

export interface ProgramFormValues {
  title: string;
  code: string;
  description: string;
  durationHours: string;
  status: string;
}

export const EMPTY_PROGRAM: ProgramFormValues = {
  title: "",
  code: "",
  description: "",
  durationHours: "",
  status: "DRAFT",
};

const initialState: ProgramActionResult = { success: false };

export function ProgramForm({
  programId,
  defaultValues,
  cancelHref,
}: {
  programId?: string;
  defaultValues: ProgramFormValues;
  cancelHref: string;
}) {
  const action = programId ? updateProgram.bind(null, programId) : createProgram;
  const [state, formAction] = useActionState(action, initialState);
  const err = (f: string) => state.fieldErrors?.[f];

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-border bg-card p-4">
      {state.message ? (
        <p
          role="status"
          className={
            state.success
              ? "rounded-lg border border-[color:var(--brand-success)]/40 bg-[color:var(--brand-success)]/10 px-3 py-2 text-sm text-[color:var(--brand-success)]"
              : "rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          }
        >
          {state.message}
        </p>
      ) : null}

      <FormField id="title" label="Intitulé de la formation" required error={err("title")}>
        <Input id="title" name="title" defaultValue={defaultValues.title} required maxLength={200} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          id="code"
          label="Code"
          error={err("code")}
          hint="Référence portée sur les conventions."
        >
          <Input id="code" name="code" defaultValue={defaultValues.code} maxLength={40} />
        </FormField>
        <FormField
          id="durationHours"
          label="Durée (heures)"
          error={err("durationHours")}
          hint="Durée réglementaire."
        >
          <Input
            id="durationHours"
            name="durationHours"
            inputMode="numeric"
            defaultValue={defaultValues.durationHours}
          />
        </FormField>
        <FormField id="status" label="Statut" error={err("status")}>
          <Select id="status" name="status" defaultValue={defaultValues.status}>
            <option value="DRAFT">Brouillon</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archivée</option>
          </Select>
        </FormField>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={defaultValues.description}
        />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>{programId ? "Enregistrer" : "Créer la formation"}</SubmitButton>
        <Button variant="ghost" asChild>
          <Link href={cancelHref}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
