"use client";

import { useActionState } from "react";

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
    twitterUrl: string;
    youtubeUrl: string;
  };
}

export function ProfileForm({ defaultValues }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="firstName" label="Prénom" required error={errors.firstName?.[0]}>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={defaultValues.firstName}
            required
            disabled={pending}
          />
        </FormField>
        <FormField id="lastName" label="Nom" required error={errors.lastName?.[0]}>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={defaultValues.lastName}
            required
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
