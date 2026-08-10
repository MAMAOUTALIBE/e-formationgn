"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormDraft } from "@/components/ui/form-draft";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  createCenterAccount,
  type CreateAccountResult,
} from "@/server/actions/admin-accounts";

const initialState: CreateAccountResult = { success: false };

export interface CompanyOption {
  id: string;
  name: string;
  city: string | null;
}

/**
 * Création d'un compte par le centre.
 *
 * Le mot de passe provisoire n'est affiché qu'ici, une seule fois : il n'est
 * stocké que haché, donc irrécupérable ensuite. Si l'admin le perd, il le
 * regénère depuis la fiche du compte.
 */
export function CreateAccountForm({ companies }: { companies: CompanyOption[] }) {
  const [state, formAction] = useActionState(createCenterAccount, initialState);
  const errors = state.fieldErrors ?? {};

  // React 19 réinitialise le formulaire dès que l'action a répondu, même sur
  // un échec. Les champs reprennent leur `defaultValue` : en y mettant ce que
  // l'action vient de recevoir, la réinitialisation restaure la saisie.
  const sent = state.values;
  // Sans société enregistrée, aucun élève ne peut être créé : le rattachement
  // est obligatoire et se fait dans une liste. On le dit plutôt que de laisser
  // l'utilisateur buter sur une erreur de validation.
  const noCompany = companies.length === 0;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="role" value="STUDENT" />
      {/* Brouillon local : survit à un rafraîchissement ou à un onglet fermé.
          Aucun mot de passe n'y transite — FormDraft ignore ces champs. */}
      <FormDraft storageKey="compte:nouveau" clearWhen={state.success} signal={state} />
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
          <Input id="firstName" name="firstName" defaultValue={sent?.firstName ?? ""} required maxLength={80} />
        </FormField>
        <FormField id="lastName" label="Nom" error={errors.lastName?.[0]}>
          <Input id="lastName" name="lastName" defaultValue={sent?.lastName ?? ""} required maxLength={80} />
        </FormField>
      </div>

      <div>
        <FormField id="email" label="Email" error={errors.email?.[0]}>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={sent?.email ?? ""}
            required
            placeholder="eleve@exemple.com"
          />
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          id="phone"
          label="Téléphone"
          hint="Facultatif."
          error={errors.phone?.[0]}
        >
          <Input id="phone" name="phone" defaultValue={sent?.phone ?? ""} type="tel" maxLength={40} />
        </FormField>

        <FormField
          id="companyId"
          label="Société de rattachement"
          required
          error={errors.companyId?.[0]}
          hint={
            noCompany
              ? undefined
              : "Choix dans la liste : la saisie libre créerait des doublons de client."
          }
        >
          <Select
            id="companyId"
            name="companyId"
            required
            disabled={noCompany}
            defaultValue={sent?.companyId ?? ""}
          >
            <option value="" disabled>
              {noCompany ? "Aucune société enregistrée" : "Sélectionner une société…"}
            </option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.city ? ` — ${c.city}` : ""}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {noCompany ? (
        <Alert variant="destructive">
          <AlertDescription>
            Aucune société n&apos;est enregistrée. Créez d&apos;abord la société
            avant d&apos;y rattacher un élève —{" "}
            <Link href="/admin/societes/nouvelle" className="font-medium underline">
              créer une société
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      <SubmitButton disabled={noCompany}>
        Créer l&apos;apprenant
      </SubmitButton>
    </form>
  );
}
