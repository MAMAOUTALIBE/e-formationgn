"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { registerUser, type ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerUser, initialState);

  if (state.success) {
    return (
      <Alert variant="success">
        <AlertDescription>
          {state.message ??
            "Inscription réussie. Vérifiez votre boîte mail pour confirmer votre adresse."}
        </AlertDescription>
      </Alert>
    );
  }

  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {state.message && !state.success ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="firstName"
          label="Prénom"
          required
          error={errors.firstName?.[0]}
        >
          <Input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            disabled={pending}
          />
        </FormField>

        <FormField
          id="lastName"
          label="Nom"
          required
          error={errors.lastName?.[0]}
        >
          <Input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            required
            disabled={pending}
          />
        </FormField>
      </div>

      <FormField id="email" label="Email" required error={errors.email?.[0]}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
        />
      </FormField>

      <FormField
        id="password"
        label="Mot de passe"
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

      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="acceptTerms"
          required
          disabled={pending}
          className="mt-0.5 h-4 w-4 rounded border-border text-[color:var(--brand-secondary)] focus:ring-[color:var(--brand-secondary)]"
        />
        <span>
          J&apos;accepte les{" "}
          <Link href="/cgv" className="text-[color:var(--brand-secondary)] hover:underline">
            conditions générales d&apos;utilisation
          </Link>{" "}
          et la{" "}
          <Link href="/confidentialite" className="text-[color:var(--brand-secondary)] hover:underline">
            politique de confidentialité
          </Link>
          .
        </span>
      </label>
      {errors.acceptTerms?.[0] ? (
        <p className="text-xs text-destructive" role="alert">
          {errors.acceptTerms[0]}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Création du compte…" : "Créer mon compte"}
      </Button>
    </form>
  );
}
