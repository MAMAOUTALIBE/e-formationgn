"use client";

// Création d'une session pour un programme donné.
//
// Formulaire compact posé sous la liste des sessions de la fiche programme :
// créer une session est un geste courant, l'envoyer sur un écran séparé
// coûterait deux navigations pour trois champs.

import { useActionState } from "react";

import { FormDraft } from "@/components/ui/form-draft";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  createTrainingSession,
  type ProgramActionResult,
} from "@/server/actions/admin-programs";

const initialState: ProgramActionResult = { success: false };

export function SessionForm({ programId }: { programId: string }) {
  const [state, formAction] = useActionState(createTrainingSession, initialState);
  const err = (f: string) => state.fieldErrors?.[f];

  // React 19 réinitialise le formulaire dès que l'action a répondu, même sur
  // un échec : on repasse en `defaultValue` ce qu'elle vient de recevoir, pour
  // que la réinitialisation restaure la saisie au lieu de l'effacer.
  const sent = state.values;

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-dashed border-border p-3">
      {/* Brouillon local : le champ programId, caché, est ignoré. */}
      <FormDraft storageKey={`session:${programId}`} clearWhen={state.success} signal={state} />

      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Nouvelle session
      </p>

      {state.message ? (
        <p
          role="status"
          className={
            state.success
              ? "text-sm text-[color:var(--brand-success)]"
              : "text-sm text-red-700 dark:text-red-400"
          }
        >
          {state.message}
        </p>
      ) : null}

      <input type="hidden" name="programId" value={programId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="startDate" label="Début" required error={err("startDate")}>
          <Input id="startDate" name="startDate" type="date" defaultValue={sent?.startDate ?? ""} required />
        </FormField>
        <FormField id="endDate" label="Fin" required error={err("endDate")}>
          <Input id="endDate" name="endDate" type="date" defaultValue={sent?.endDate ?? ""} required />
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="reference" label="Référence" error={err("reference")}>
          <Input id="reference" name="reference" defaultValue={sent?.reference ?? ""} placeholder="2026-S1-LYON" maxLength={60} />
        </FormField>
        <FormField id="location" label="Lieu / modalité" error={err("location")}>
          <Input id="location" name="location" defaultValue={sent?.location ?? ""} placeholder="Distanciel" maxLength={160} />
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          id="capacity"
          label="Places"
          error={err("capacity")}
          hint="Vide = illimité."
        >
          <Input id="capacity" name="capacity" defaultValue={sent?.capacity ?? ""} inputMode="numeric" />
        </FormField>
        <FormField id="status" label="Statut" error={err("status")}>
          <Select id="status" name="status" defaultValue={sent?.status ?? "PLANNED"}>
            <option value="PLANNED">Planifiée</option>
            <option value="ACTIVE">En cours</option>
            <option value="COMPLETED">Terminée</option>
            <option value="CANCELLED">Annulée</option>
          </Select>
        </FormField>
      </div>

      <SubmitButton size="sm">Créer la session</SubmitButton>
    </form>
  );
}
