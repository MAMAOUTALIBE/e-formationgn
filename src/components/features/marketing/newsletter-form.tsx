"use client";

// Formulaire d'inscription newsletter — variante compacte (footer) ou large
// (section dédiée). Consentement RGPD case à cocher OBLIGATOIRE (validée
// côté serveur aussi). Affiche un message succès/erreur inline après submit.

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { subscribeNewsletter } from "@/server/actions/newsletter";

import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

interface NewsletterFormProps {
  /** Source affichée dans `NewsletterSubscription.source` (analytics). */
  source?: string;
  /** Variant compact (footer/sidebar) ou large (section dédiée). */
  variant?: "compact" | "large";
  className?: string;
}

export function NewsletterForm({
  source = "footer",
  variant = "compact",
  className,
}: NewsletterFormProps) {
  const [state, formAction, pending] = useActionState(subscribeNewsletter, initialState);
  const consentError = state.fieldErrors?.consent?.[0];
  const emailError = state.fieldErrors?.email?.[0];

  if (state.success) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-md border border-[color:var(--brand-success)]/30 bg-[color:var(--brand-success)]/10 px-4 py-3 text-sm text-foreground ${className ?? ""}`}
        role="status"
      >
        <CheckCircle2
          className="h-4 w-4 text-[color:var(--brand-success)]"
          aria-hidden
        />
        <span>{state.message}</span>
      </div>
    );
  }

  return (
    <form action={formAction} className={`space-y-3 ${className ?? ""}`} noValidate>
      <input type="hidden" name="source" value={source} />

      <div className={variant === "large" ? "sm:flex sm:gap-2" : ""}>
        <div className="flex-1">
          <label htmlFor={`newsletter-email-${source}`} className="sr-only">
            Adresse email
          </label>
          <Input
            id={`newsletter-email-${source}`}
            name="email"
            type="email"
            required
            placeholder="votre@email.com"
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? `newsletter-email-error-${source}` : undefined}
            disabled={pending}
          />
          {emailError ? (
            <p
              id={`newsletter-email-error-${source}`}
              className="mt-1 text-xs text-[color:var(--brand-danger)]"
            >
              {emailError}
            </p>
          ) : null}
        </div>
        <Button
          type="submit"
          disabled={pending}
          className={variant === "large" ? "mt-2 sm:mt-0" : "mt-0 w-full"}
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Envoi…
            </>
          ) : (
            "S'inscrire"
          )}
        </Button>
      </div>

      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <Checkbox name="consent" defaultChecked={false} required disabled={pending} />
        <span>
          J&apos;accepte de recevoir des emails de Gandal (1 à 2 par mois,
          désinscription en un clic). Voir notre{" "}
          <a
            href="/confidentialite"
            className="text-[color:var(--brand-secondary)] underline-offset-4 hover:underline"
          >
            politique de confidentialité
          </a>
          .
        </span>
      </label>
      {consentError ? (
        <p role="alert" className="text-xs text-[color:var(--brand-danger)]">
          {consentError}
        </p>
      ) : null}

      {state.message && !state.success && !consentError ? (
        <p role="alert" className="text-xs text-[color:var(--brand-danger)]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
