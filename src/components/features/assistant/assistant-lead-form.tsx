"use client";

// Formulaire d'escalade — « Contacter un conseiller ».
//
// C'est la seule voie de capture de contact du site : `/contact` est une page
// de texte, sans formulaire. Le fil de discussion est joint côté serveur, donc
// le message reste facultatif ici : exiger une re-saisie de ce qui vient
// d'être demandé à l'assistant fait abandonner le formulaire.

import { useActionState } from "react";

import { submitAssistantLead, type AssistantLeadResult } from "@/server/actions/assistant";

const INITIAL: AssistantLeadResult = { ok: false };

interface AssistantLeadFormProps {
  /** Formation en contexte, transmise en champ caché. */
  courseSlug?: string | null;
  onDone?: () => void;
}

export function AssistantLeadForm({ courseSlug, onDone }: AssistantLeadFormProps) {
  const [state, formAction, pending] = useActionState(submitAssistantLead, INITIAL);

  if (state.ok) {
    return (
      <div
        role="status"
        className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-200"
      >
        <p className="font-semibold">Demande transmise</p>
        <p className="mt-1">{state.message}</p>
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="mt-3 text-sm font-semibold underline underline-offset-4"
          >
            Revenir à la conversation
          </button>
        ) : null}
      </div>
    );
  }

  const err = (field: string) => state.fieldErrors?.[field];

  return (
    <form action={formAction} noValidate className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Laissez vos coordonnées : un conseiller Aiduca vous recontacte. Votre
        échange avec l&apos;assistant est joint à la demande.
      </p>

      {courseSlug ? (
        <input type="hidden" name="courseSlug" value={courseSlug} />
      ) : null}

      <Field id="assistant-lead-name" label="Nom" error={err("name")}>
        <input
          id="assistant-lead-name"
          name="name"
          required
          maxLength={120}
          autoComplete="name"
          className={inputClass(Boolean(err("name")))}
        />
      </Field>

      <Field id="assistant-lead-email" label="E-mail" error={err("email")}>
        <input
          id="assistant-lead-email"
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          className={inputClass(Boolean(err("email")))}
        />
      </Field>

      <Field
        id="assistant-lead-phone"
        label="Téléphone (facultatif)"
        error={err("phone")}
      >
        <input
          id="assistant-lead-phone"
          name="phone"
          type="tel"
          maxLength={30}
          autoComplete="tel"
          className={inputClass(Boolean(err("phone")))}
        />
      </Field>

      <Field
        id="assistant-lead-message"
        label="Précisions (facultatif)"
        error={err("message")}
      >
        <textarea
          id="assistant-lead-message"
          name="message"
          rows={3}
          maxLength={2000}
          className={inputClass(Boolean(err("message")))}
        />
      </Field>

      <div>
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="consent"
            value="on"
            className="mt-1 h-4 w-4 shrink-0 rounded border-border"
          />
          <span>
            J&apos;accepte qu&apos;Aiduca conserve ces informations pour me
            recontacter au sujet de ma demande.
          </span>
        </label>
        {err("consent") ? (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {err("consent")}
          </p>
        ) : null}
      </div>

      {state.message && !state.fieldErrors ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[color:var(--brand-secondary)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
      >
        {pending ? "Envoi…" : "Envoyer ma demande"}
      </button>
    </form>
  );
}

function inputClass(hasError: boolean): string {
  return [
    "w-full rounded-xl border bg-background px-3 py-2 text-base outline-none",
    "focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
    hasError ? "border-red-500" : "border-border",
  ].join(" ");
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
