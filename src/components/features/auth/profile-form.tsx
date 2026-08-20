"use client";

import { useActionState } from "react";

import { FormDraft } from "@/components/ui/form-draft";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateProfile } from "@/server/actions/profile";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

interface ProfileFormProps {
  defaultValues: {
    firstName: string;
    lastName: string;
    headline: string;
    bio: string;
    websiteUrl: string;
    linkedinUrl: string;
    facebookUrl: string;
    twitterUrl: string;
    youtubeUrl: string;
  };
  identityLocked?: boolean;
}

export function ProfileForm({ defaultValues, identityLocked = false }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {/* Brouillon local : la saisie survit à un échec d'enregistrement,
          à un rafraîchissement ou à un onglet fermé. */}
      <FormDraft storageKey={"profil"} clearWhen={state.success} signal={state} />

      {state.success && state.message ? (
        <Alert variant="success">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.message && !state.success ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {identityLocked ? (
        <Alert>
          <AlertDescription>
            Votre identité est verrouillée. Contactez l’administration pour corriger votre prénom, votre nom ou votre photo.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="firstName"
          label="Prénom"
          required={!identityLocked}
          error={errors.firstName?.[0]}
        >
          <Input
            id="firstName"
            name={identityLocked ? undefined : "firstName"}
            defaultValue={defaultValues.firstName}
            required={!identityLocked}
            readOnly={identityLocked}
            aria-readonly={identityLocked}
            disabled={pending}
          />
        </FormField>
        <FormField
          id="lastName"
          label="Nom"
          required={!identityLocked}
          error={errors.lastName?.[0]}
        >
          <Input
            id="lastName"
            name={identityLocked ? undefined : "lastName"}
            defaultValue={defaultValues.lastName}
            required={!identityLocked}
            readOnly={identityLocked}
            aria-readonly={identityLocked}
            disabled={pending}
          />
        </FormField>
      </div>

      <FormField
        id="headline"
        label="Titre court"
        hint="Une phrase qui vous décrit (ex: « Développeur Full-Stack »)."
        error={errors.headline?.[0]}
      >
        <Input
          id="headline"
          name="headline"
          defaultValue={defaultValues.headline}
          disabled={pending}
          maxLength={120}
        />
      </FormField>

      <FormField id="bio" label="Biographie" error={errors.bio?.[0]}>
        <Textarea
          id="bio"
          name="bio"
          rows={5}
          defaultValue={defaultValues.bio}
          disabled={pending}
          maxLength={2000}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="websiteUrl" label="Site web" error={errors.websiteUrl?.[0]}>
          <Input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            defaultValue={defaultValues.websiteUrl}
            disabled={pending}
            placeholder="https://"
          />
        </FormField>
        <FormField id="linkedinUrl" label="LinkedIn" error={errors.linkedinUrl?.[0]}>
          <Input
            id="linkedinUrl"
            name="linkedinUrl"
            type="url"
            defaultValue={defaultValues.linkedinUrl}
            disabled={pending}
            placeholder="https://www.linkedin.com/in/..."
          />
        </FormField>
        <FormField id="twitterUrl" label="X / Twitter" error={errors.twitterUrl?.[0]}>
          <Input
            id="twitterUrl"
            name="twitterUrl"
            type="url"
            defaultValue={defaultValues.twitterUrl}
            disabled={pending}
            placeholder="https://twitter.com/..."
          />
        </FormField>
        <FormField id="facebookUrl" label="Facebook" error={errors.facebookUrl?.[0]}>
          <Input
            id="facebookUrl"
            name="facebookUrl"
            type="url"
            defaultValue={defaultValues.facebookUrl}
            disabled={pending}
            placeholder="https://facebook.com/..."
          />
        </FormField>
        <FormField id="youtubeUrl" label="YouTube" error={errors.youtubeUrl?.[0]}>
          <Input
            id="youtubeUrl"
            name="youtubeUrl"
            type="url"
            defaultValue={defaultValues.youtubeUrl}
            disabled={pending}
            placeholder="https://youtube.com/@..."
          />
        </FormField>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer les modifications"}
        </Button>
      </div>
    </form>
  );
}
