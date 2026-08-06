"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { changeTemporaryPassword } from "@/server/actions/first-login-password";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

export function FirstPasswordForm() {
  const [state, formAction] = useActionState(changeTemporaryPassword, initialState);
  const errors = state.fieldErrors ?? {};

  // Après succès, la session est invalidée (passwordChangedAt) : on n'affiche
  // plus le formulaire mais l'invitation à se reconnecter.
  if (state.success) {
    return (
      <div className="space-y-4">
        <Alert variant="success">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
        <Link
          href="/connexion"
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[color:var(--brand-secondary)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <FormField
        id="currentPassword"
        label="Mot de passe provisoire"
        error={errors.currentPassword?.[0]}
      >
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </FormField>

      <FormField id="password" label="Nouveau mot de passe" error={errors.password?.[0]}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </FormField>

      <FormField
        id="confirmPassword"
        label="Confirmer le nouveau mot de passe"
        error={errors.confirmPassword?.[0]}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </FormField>

      <SubmitButton className="w-full">Changer mon mot de passe</SubmitButton>
    </form>
  );
}
