"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { resetPassword, type ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [state, formAction, pending] = useActionState(resetPassword, initialState);
  const errors = state.fieldErrors ?? {};

  if (state.success) {
    return (
      <div className="space-y-4">
        <Alert variant="success">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/connexion">Se connecter</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <FormField
        id="password"
        label="Nouveau mot de passe"
        required
        error={errors.password?.[0]}
        hint="Au moins 8 caractères, avec lettres et chiffres."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
        />
      </FormField>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Mise à jour…" : "Réinitialiser mon mot de passe"}
      </Button>
    </form>
  );
}
