"use client";

import { useActionState } from "react";

import { FormDraft } from "@/components/ui/form-draft";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateCoursePricing } from "@/server/actions/instructor";
import type { ActionResult } from "@/server/actions/auth";

import { useAdvanceOnSuccess } from "./use-advance-on-success";

const initialState: ActionResult = { success: false };

interface CoursePricingFormProps {
  courseId: string;
  defaults: {
    priceEUR: number;
    priceUSD: number;
    priceGNF: number;
    priceXOF: number;
    discountPriceEUR: number | null;
    discountPriceUSD: number | null;
    discountPriceGNF: number | null;
    discountPriceXOF: number | null;
    discountEndsAt: string;
  };
  /** Étape suivante de l'assistant — auto-avance après enregistrement. */
  nextHref?: string;
}

export function CoursePricingForm({
  courseId,
  defaults,
  nextHref,
}: CoursePricingFormProps) {
  const action = updateCoursePricing.bind(null, courseId);
  const [state, formAction] = useActionState(action, initialState);
  const errors = state.fieldErrors ?? {};
  useAdvanceOnSuccess(state.success, nextHref);

  return (
    <form action={formAction} className="space-y-8">
      {/* Brouillon local : la saisie survit à un échec d'enregistrement,
          à un rafraîchissement ou à un onglet fermé. */}
      <FormDraft storageKey={`cours-tarifs:${courseId}`} clearWhen={state.success} signal={state} />

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
        Fixez votre prix dans chaque devise. Mettez{" "}
        <code className="rounded bg-muted px-1">0</code> pour ne pas vendre dans
        cette devise (le cours n&apos;apparaîtra pas dans le panier des élèves
        qui ont sélectionné cette devise).
      </p>

      {/* ============================================================
          Cartes internationales (Stripe) — EUR / USD
          ============================================================ */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Cartes internationales — Stripe
        </h3>
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
                defaults.discountPriceEUR !== null
                  ? String(defaults.discountPriceEUR)
                  : ""
              }
            />
          </FormField>
          <FormField
            id="discountPriceUSD"
            label="Prix promo USD"
            error={errors.discountPriceUSD?.[0]}
            hint="Optionnel."
          >
            <Input
              id="discountPriceUSD"
              name="discountPriceUSD"
              type="number"
              step="0.01"
              min="0"
              max="9999"
              defaultValue={
                defaults.discountPriceUSD !== null
                  ? String(defaults.discountPriceUSD)
                  : ""
              }
            />
          </FormField>
        </div>
      </section>

      {/* ============================================================
          Mobile Money / cartes locales (CinetPay) — GNF / XOF
          ============================================================ */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Mobile Money &amp; cartes locales — CinetPay
        </h3>
        <p className="text-xs text-muted-foreground">
          Pour la Guinée (GNF, Orange Money / MTN MoMo) et l&apos;Afrique de
          l&apos;Ouest francophone (XOF — Sénégal, Côte d&apos;Ivoire, Mali).
          Pas de décimales pour ces devises.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="priceGNF" label="Prix GNF (FG)" required error={errors.priceGNF?.[0]}>
            <Input
              id="priceGNF"
              name="priceGNF"
              type="number"
              step="1"
              min="0"
              max="99999999"
              required
              defaultValue={String(defaults.priceGNF)}
            />
          </FormField>
          <FormField id="priceXOF" label="Prix XOF (FCFA)" required error={errors.priceXOF?.[0]}>
            <Input
              id="priceXOF"
              name="priceXOF"
              type="number"
              step="1"
              min="0"
              max="9999999"
              required
              defaultValue={String(defaults.priceXOF)}
            />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="discountPriceGNF"
            label="Prix promo GNF"
            error={errors.discountPriceGNF?.[0]}
            hint="Optionnel."
          >
            <Input
              id="discountPriceGNF"
              name="discountPriceGNF"
              type="number"
              step="1"
              min="0"
              max="99999999"
              defaultValue={
                defaults.discountPriceGNF !== null
                  ? String(defaults.discountPriceGNF)
                  : ""
              }
            />
          </FormField>
          <FormField
            id="discountPriceXOF"
            label="Prix promo XOF"
            error={errors.discountPriceXOF?.[0]}
            hint="Optionnel."
          >
            <Input
              id="discountPriceXOF"
              name="discountPriceXOF"
              type="number"
              step="1"
              min="0"
              max="9999999"
              defaultValue={
                defaults.discountPriceXOF !== null
                  ? String(defaults.discountPriceXOF)
                  : ""
              }
            />
          </FormField>
        </div>
      </section>

      <FormField
        id="discountEndsAt"
        label="Fin de la promo (toutes devises)"
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
        <SubmitButton>
          {nextHref ? "Enregistrer et continuer" : "Enregistrer"}
        </SubmitButton>
      </div>
    </form>
  );
}
