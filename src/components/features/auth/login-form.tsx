"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { loginWithCredentials, type ActionResult } from "@/server/actions/auth";
import { TurnstileWidget } from "./turnstile-widget";

const initialState: ActionResult = { success: false };

interface LoginFormProps {
  callbackUrl?: string;
  /**
   * Vrai lorsqu'un fournisseur d'e-mails transactionnels est configuré.
   * Calculé côté serveur : le formulaire n'a pas accès à l'environnement.
   */
  passwordResetAvailable?: boolean;
}

export function LoginForm({ callbackUrl, passwordResetAvailable = false }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginWithCredentials, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}

      {state.message && !state.success ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

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

      <FormField id="password" label="Mot de passe" required error={errors.password?.[0]}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </FormField>

      {/* Le lien de réinitialisation n'est proposé que si l'envoi d'e-mails
          est réellement configuré. Sans fournisseur, la page d'après affiche
          « service temporairement indisponible » — un cul-de-sac, doublé d'un
          message faux puisque rien n'est temporaire. On oriente alors vers le
          seul chemin qui fonctionne : le centre régénère un mot de passe depuis
          la fiche de l'apprenant. */}
      <div className="flex items-center justify-end">
        {passwordResetAvailable ? (
          <Link
            href="/mot-de-passe-oublie"
            className="text-sm text-[color:var(--brand-secondary)] underline underline-offset-4 hover:no-underline"
          >
            Mot de passe oublié ?
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            Mot de passe oublié&nbsp;?{" "}
            <Link
              href="/contact"
              className="text-[color:var(--brand-secondary)] underline underline-offset-4 hover:no-underline"
            >
              Contactez le centre
            </Link>
            , il vous en délivrera un nouveau.
          </p>
        )}
      </div>

      <TurnstileWidget formId="login" />

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
