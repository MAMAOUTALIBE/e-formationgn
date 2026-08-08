"use client";

// Formulaire de création / modification d'une société cliente.
//
// Un seul composant pour les deux cas : les champs sont identiques, seule
// l'action diffère. Dupliquer aurait garanti une divergence au premier champ
// ajouté.

import Link from "next/link";
import { useActionState } from "react";
import {
  Building2,
  ClipboardList,
  Landmark,
  MapPin,
  UserRound,
} from "lucide-react";

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
    <form action={formAction} className="space-y-4" data-testid="company-form">
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

      <CompanyFormSection
        icon={<Building2 />}
        title="Informations générales"
        description="Identité légale de l’entreprise ou de l’organisme partenaire."
      >

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
      </CompanyFormSection>

      <CompanyFormSection
        icon={<MapPin />}
        title="Adresse"
        description="Coordonnées utilisées sur les dossiers et documents administratifs."
      >
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
      </CompanyFormSection>

      <CompanyFormSection
        icon={<UserRound />}
        title="Contact principal"
        description="Interlocuteur à contacter pour le suivi des apprenants."
      >
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
      </CompanyFormSection>

      <CompanyFormSection
        icon={<Landmark />}
        title="Financement & dossier"
        description="Informations OPCO nécessaires au traitement administratif."
      >
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
      </CompanyFormSection>

      <CompanyFormSection
        icon={<ClipboardList />}
        title="Suivi & statut"
        description="État de la relation et informations visibles uniquement par l’équipe CRM."
      >
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
      </CompanyFormSection>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-border/80 bg-background/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur">
        <SubmitButton>{companyId ? "Enregistrer" : "Créer la société"}</SubmitButton>
        <Button variant="ghost" asChild>
          <Link href={cancelHref}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}

function CompanyFormSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-slot="card"
      className="overflow-hidden rounded-2xl border border-border/75 bg-card shadow-[0_8px_28px_rgba(15,23,42,0.04)]"
    >
      <header className="flex items-start gap-3 border-b border-border/60 bg-muted/20 px-4 py-3.5 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[color:var(--brand-primary)] dark:bg-blue-500/10 [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
          {icon}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </header>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}
