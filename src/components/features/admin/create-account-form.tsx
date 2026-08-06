"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  createCenterAccount,
  type CreateAccountResult,
} from "@/server/actions/admin-accounts";

const initialState: CreateAccountResult = { success: false };

/**
 * Création d'un compte par le centre.
 *
 * Le mot de passe provisoire n'est affiché qu'ici, une seule fois : il n'est
 * stocké que haché, donc irrécupérable ensuite. Si l'admin le perd, il le
 * regénère depuis la fiche du compte.
 */
export function CreateAccountForm() {
  const [state, formAction] = useActionState(createCenterAccount, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {state.success && state.temporaryPassword ? (
        <Alert variant="success">
          <AlertDescription>
            <p className="font-medium">Compte créé pour {state.createdEmail}</p>
            <p className="mt-2 text-sm">
              Mot de passe — transmettez-le par email, il ne sera plus affiché :
            </p>
            <code className="mt-1 block rounded-md bg-background px-3 py-2 font-mono text-base tracking-wide text-foreground">
              {state.temporaryPassword}
            </code>
            <p className="mt-2 text-xs">
              Ce mot de passe reste valable tant que la personne ne le change
              pas elle-même depuis son profil.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {!state.success && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="firstName" label="Prénom" error={errors.firstName?.[0]}>
          <Input id="firstName" name="firstName" required maxLength={80} />
        </FormField>
        <FormField id="lastName" label="Nom" error={errors.lastName?.[0]}>
          <Input id="lastName" name="lastName" required maxLength={80} />
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <FormField id="email" label="Email" error={errors.email?.[0]}>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="eleve@exemple.com"
          />
        </FormField>
        <FormField id="role" label="Type de compte" error={errors.role?.[0]}>
          <Select id="role" name="role" defaultValue="STUDENT" required>
            <option value="STUDENT">Élève</option>
            <option value="INSTRUCTOR">Formateur</option>
          </Select>
        </FormField>
      </div>

      <SubmitButton>Créer le compte</SubmitButton>
    </form>
  );
}
