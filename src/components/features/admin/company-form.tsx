"use client";

// Formulaire de création / modification d'une société cliente.
//
// Un seul composant pour les deux cas : les champs sont identiques, seule
// l'action diffère. Dupliquer aurait garanti une divergence au premier champ
// ajouté.

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormDraft } from "@/components/ui/form-draft";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import {
  createCompany,
  updateCompany,
  type CompanyActionResult,
} from "@/server/actions/admin-companies";

export interface CompanyFormValues {
  name: string;
  siret: string;
  siren: string;
  vatNumber: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  opco: string;
  opcoReference: string;
  notes: string;
  status: string;
}

export const EMPTY_COMPANY: CompanyFormValues = {
  name: "",
  siret: "",
  siren: "",
  vatNumber: "",
  addressLine1: "",
  addressLine2: "",
  postalCode: "",
  city: "",
  country: "France",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  opco: "",
  opcoReference: "",
  notes: "",
  status: "ACTIVE",
};

const initialState: CompanyActionResult = { success: false };

export function CompanyForm({
  companyId,
  defaultValues,
  cancelHref,
}: {
  /** Absent = création. */
  companyId?: string;
  defaultValues: CompanyFormValues;
  cancelHref: string;
}) {
  const action = companyId
    ? updateCompany.bind(null, companyId)
    : createCompany;
  const [state, formAction] = useActionState(action, initialState);

  const err = (field: string) => state.fieldErrors?.[field];

  // React 19 réinitialise le formulaire dès que l'action a répondu, y compris
  // sur un échec de validation. Les champs reviennent alors à leur
  // `defaultValue` : en y plaçant ce que l'action vient de recevoir, cette
  // réinitialisation restaure la saisie au lieu de l'effacer.
  const values: CompanyFormValues = { ...defaultValues, ...(state.values ?? {}) };

  return (
    <form action={formAction} className="space-y-6">
      {/* Brouillon local : survit à un rafraîchissement ou à un onglet fermé. */}
      <FormDraft
        storageKey={companyId ? `societe:${companyId}` : "societe:nouvelle"}
        clearWhen={state.success}
        signal={state}
      />
      {state.message ? (
        <p
          role="status"
          className={
            state.success
              ? "rounded-lg border border-[color:var(--brand-success)]/40 bg-[color:var(--brand-success)]/10 px-3 py-2 text-sm text-[color:var(--brand-success)]"
              : "rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
          }
        >
          {state.message}
        </p>
      ) : null}

      <section className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Identité</h2>

        <FormField id="name" label="Raison sociale" required error={err("name")}>
          <Input id="name" name="name" defaultValue={values.name} required maxLength={200} />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="siret"
            label="SIRET"
            error={err("siret")}
            hint="14 chiffres. Sert à détecter les doublons de société."
          >
            <Input id="siret" name="siret" defaultValue={values.siret} inputMode="numeric" />
          </FormField>
          <FormField id="siren" label="SIREN" error={err("siren")} hint="9 chiffres.">
            <Input id="siren" name="siren" defaultValue={values.siren} inputMode="numeric" />
          </FormField>
        </div>

        <FormField id="vatNumber" label="N° de TVA intracommunautaire" error={err("vatNumber")}>
          <Input id="vatNumber" name="vatNumber" defaultValue={values.vatNumber} />
        </FormField>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Adresse</h2>
        <FormField id="addressLine1" label="Adresse" error={err("addressLine1")}>
          <Input id="addressLine1" name="addressLine1" defaultValue={values.addressLine1} />
        </FormField>
        <FormField id="addressLine2" label="Complément" error={err("addressLine2")}>
          <Input id="addressLine2" name="addressLine2" defaultValue={values.addressLine2} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="postalCode" label="Code postal" error={err("postalCode")}>
            <Input id="postalCode" name="postalCode" defaultValue={values.postalCode} />
          </FormField>
          <FormField id="city" label="Ville" error={err("city")}>
            <Input id="city" name="city" defaultValue={values.city} />
          </FormField>
          <FormField id="country" label="Pays" error={err("country")}>
            <Input id="country" name="country" defaultValue={values.country} />
          </FormField>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Responsable</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="contactName" label="Nom" error={err("contactName")}>
            <Input id="contactName" name="contactName" defaultValue={values.contactName} />
          </FormField>
          <FormField id="contactEmail" label="E-mail" error={err("contactEmail")}>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={values.contactEmail}
            />
          </FormField>
          <FormField id="contactPhone" label="Téléphone" error={err("contactPhone")}>
            <Input id="contactPhone" name="contactPhone" defaultValue={values.contactPhone} />
          </FormField>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Financement</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="opco"
            label="OPCO"
            error={err("opco")}
            hint="Opérateur de compétences finançant les formations."
          >
            <Input id="opco" name="opco" defaultValue={values.opco} />
          </FormField>
          <FormField id="opcoReference" label="N° d'adhérent / dossier" error={err("opcoReference")}>
            <Input
              id="opcoReference"
              name="opcoReference"
              defaultValue={values.opcoReference}
            />
          </FormField>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Suivi</h2>
        <FormField
          id="status"
          label="Statut"
          error={err("status")}
          hint="Une société archivée n'est plus proposée au rattachement d'un élève, mais conserve les siens."
        >
          <select
            id="status"
            name="status"
            defaultValue={values.status}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archivée</option>
          </select>
        </FormField>

        <div>
          <Label htmlFor="notes">Notes internes</Label>
          <Textarea id="notes" name="notes" rows={4} defaultValue={values.notes} />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <SubmitButton>{companyId ? "Enregistrer" : "Créer la société"}</SubmitButton>
        <Button variant="ghost" asChild>
          <Link href={cancelHref}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
