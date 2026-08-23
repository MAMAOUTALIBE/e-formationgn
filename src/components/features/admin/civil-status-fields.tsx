"use client";

// Bloc d'état civil, partagé par la création de compte et la correction
// d'identité.
//
// Un seul composant pour les deux écrans, en regard du schéma Zod unique
// (`civilStatusSchema`) : deux formulaires distincts finissent toujours par
// diverger d'un champ, et c'est alors la création qui admet ce que la
// correction refuse — ou l'inverse.

import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface CivilStatusValues {
  fullName: string;
  /** Format « AAAA-MM-JJ » attendu par `<input type="date">`. */
  birthDate: string;
  birthPlace: string;
  gender: string;
  phone: string;
  country: string;
  address: string;
}

export const EMPTY_CIVIL_STATUS: CivilStatusValues = {
  fullName: "",
  birthDate: "",
  birthPlace: "",
  gender: "",
  phone: "",
  country: "",
  address: "",
};

/** Met une date issue de Prisma au format du champ natif, en UTC. */
export { toDateInputValue } from "@/lib/date-input";

interface CivilStatusFieldsProps {
  values: CivilStatusValues;
  errors: Record<string, string[] | undefined>;
  disabled?: boolean;
  /** Préfixe des `id` — deux blocs sur une même page ne doivent pas se marcher dessus. */
  idPrefix?: string;
}

export function CivilStatusFields({
  values,
  errors,
  disabled,
  idPrefix = "civil",
}: CivilStatusFieldsProps) {
  const id = (field: string) => `${idPrefix}-${field}`;

  return (
    <div className="space-y-4">
      <FormField
        id={id("fullName")}
        label="Nom et prénom"
        required
        error={errors.fullName?.[0]}
        hint="Tel qu'il doit apparaître sur les attestations et l'émargement."
      >
        <Input
          id={id("fullName")}
          name="fullName"
          defaultValue={values.fullName}
          required
          minLength={2}
          maxLength={160}
          disabled={disabled}
          autoComplete="off"
        />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-3">
        <FormField
          id={id("birthDate")}
          label="Date de naissance"
          hint="Facultatif."
          error={errors.birthDate?.[0]}
        >
          <Input
            id={id("birthDate")}
            name="birthDate"
            type="date"
            defaultValue={values.birthDate}
            disabled={disabled}
          />
        </FormField>

        <FormField
          id={id("birthPlace")}
          label="Lieu de naissance"
          hint="Facultatif."
          error={errors.birthPlace?.[0]}
        >
          <Input
            id={id("birthPlace")}
            name="birthPlace"
            defaultValue={values.birthPlace}
            maxLength={160}
            disabled={disabled}
          />
        </FormField>

        <FormField
          id={id("gender")}
          label="Sexe"
          hint="Facultatif."
          error={errors.gender?.[0]}
        >
          <Select
            id={id("gender")}
            name="gender"
            defaultValue={values.gender}
            disabled={disabled}
          >
            <option value="">Non renseigné</option>
            <option value="FEMALE">Féminin</option>
            <option value="MALE">Masculin</option>
            <option value="OTHER">Autre</option>
          </Select>
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          id={id("phone")}
          label="Téléphone"
          hint="Facultatif."
          error={errors.phone?.[0]}
        >
          <Input
            id={id("phone")}
            name="phone"
            type="tel"
            defaultValue={values.phone}
            maxLength={40}
            disabled={disabled}
          />
        </FormField>

        <FormField
          id={id("country")}
          label="Pays"
          hint="Facultatif."
          error={errors.country?.[0]}
        >
          <Input
            id={id("country")}
            name="country"
            defaultValue={values.country}
            maxLength={80}
            disabled={disabled}
          />
        </FormField>
      </div>

      <FormField
        id={id("address")}
        label="Adresse postale"
        hint="Facultatif — rue, ville, code postal."
        error={errors.address?.[0]}
      >
        <Textarea
          id={id("address")}
          name="address"
          rows={2}
          defaultValue={values.address}
          maxLength={500}
          disabled={disabled}
        />
      </FormField>
    </div>
  );
}
