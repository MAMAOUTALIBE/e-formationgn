"use client";

// Correction de l'état civil d'un compte par l'administration.
//
// C'est le seul chemin d'écriture sur ces champs pour les comptes dont
// l'identité est verrouillée — l'espace apprenant les affiche en lecture
// seule. Le geste est journalisé (`user.identity_corrected`) avec l'ancienne
// et la nouvelle valeur : une identité qui figure sur des certificats ne
// change pas sans trace.

import { useActionState } from "react";

import {
  CivilStatusFields,
  type CivilStatusValues,
} from "@/components/features/admin/civil-status-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { updateAccountIdentity } from "@/server/actions/admin-accounts";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

export function AccountIdentityForm({
  userId,
  values,
  certificatesCount,
}: {
  userId: string;
  values: CivilStatusValues;
  /** Sert à avertir quand des attestations portent déjà le nom actuel. */
  certificatesCount: number;
}) {
  const [state, formAction, pending] = useActionState(
    updateAccountIdentity,
    initialState,
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />

      {state.message ? (
        <Alert variant={state.success ? "success" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <CivilStatusFields
        idPrefix="identite"
        values={values}
        errors={errors}
        disabled={pending}
      />

      {certificatesCount > 0 ? (
        <label className="flex items-start gap-2.5 rounded-md border border-border bg-muted/30 p-3">
          <Checkbox name="updateCertificates" className="mt-0.5" />
          <span className="text-xs text-muted-foreground">
            <span className="block font-medium text-foreground">
              Reporter le nom sur les {certificatesCount} attestation
              {certificatesCount > 1 ? "s" : ""} déjà émise
              {certificatesCount > 1 ? "s" : ""}
            </span>
            Le nom d&apos;une attestation est figé à son émission. Cochez pour
            un nom mal orthographié ou changé à l&apos;état civil ; laissez
            décoché si les documents déjà remis doivent rester tels quels. Les
            fichiers déjà téléchargés ne changent dans aucun cas.
          </span>
        </label>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer l'identité"}
        </Button>
      </div>
    </form>
  );
}
