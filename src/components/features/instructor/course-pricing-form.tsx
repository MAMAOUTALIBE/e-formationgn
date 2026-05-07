"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateCoursePricing } from "@/server/actions/instructor";
import type { ActionResult } from "@/server/actions/auth";

const initialState: ActionResult = { success: false };

interface CoursePricingFormProps {
  courseId: string;
  defaults: {
    priceEUR: number;
    priceUSD: number;
    discountPriceEUR: number | null;
    discountPriceUSD: number | null;
    discountEndsAt: string;
  };
}

export function CoursePricingForm({ courseId, defaults }: CoursePricingFormProps) {
  const action = updateCoursePricing.bind(null, courseId);
  const [state, formAction] = useActionState(action, initialState);
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

      <p className="text-sm text-muted-foreground">
        Saisissez le prix dans chaque devise. Mettez{" "}
        <code className="rounded bg-muted px-1">0</code> pour rendre le cours gratuit.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="priceEUR" label="Prix EUR (€)" required error={errors.priceEUR?.[0]}>
          <Input
            id="priceEUR"
            name="priceEUR"
            type="number"
            step="0.01"
            min="0"
            max="9999"
            required
            defaultValue={String(defaults.priceEUR)}
          />
        </FormField>
        <FormField id="priceUSD" label="Prix USD ($)" required error={errors.priceUSD?.[0]}>
          <Input
            id="priceUSD"
            name="priceUSD"
            type="number"
            step="0.01"
            min="0"
            max="9999"
            required
            defaultValue={String(defaults.priceUSD)}
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="discountPriceEUR"
          label="Prix promo EUR"
          error={errors.discountPriceEUR?.[0]}
          hint="Optionnel — laisser vide si pas de promo."
        >
          <Input
            id="discountPriceEUR"
            name="discountPriceEUR"
            type="number"
            step="0.01"
            min="0"
            max="9999"
            defaultValue={
              defaults.discountPriceEUR !== null ? String(defaults.discountPriceEUR) : ""
            }
          />
        </FormField>
        <FormField
          id="discountPriceUSD"
          label="Prix promo USD"
          error={errors.discountPriceUSD?.[0]}
          hint="Optionnel — laisser vide si pas de promo."
        >
          <Input
            id="discountPriceUSD"
            name="discountPriceUSD"
            type="number"
            step="0.01"
            min="0"
            max="9999"
            defaultValue={
              defaults.discountPriceUSD !== null ? String(defaults.discountPriceUSD) : ""
            }
          />
        </FormField>
      </div>

      <FormField
        id="discountEndsAt"
        label="Fin de la promo"
        error={errors.discountEndsAt?.[0]}
        hint="Date et heure de fin (laissez vide pour une promo permanente)."
      >
        <Input
          id="discountEndsAt"
          name="discountEndsAt"
          type="datetime-local"
          defaultValue={defaults.discountEndsAt}
        />
      </FormField>

      <div className="flex justify-end">
        <SubmitButton>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
