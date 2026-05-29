"use client";

import { useActionState, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useStoredValue } from "@/lib/hooks/use-persistent-state";
import { formatPriceFromCents } from "@/lib/money";
import { startCheckout } from "@/server/actions/checkout";
import { startCinetPayCheckout } from "@/server/actions/cinetpay-checkout";
import type { Currency } from "@/generated/prisma/enums";

interface CartSummaryFormProps {
  subtotalCents: number;
  currency: Currency;
  affiliateActive: boolean;
  /** Stripe configuré côté serveur (clé renseignée). Sinon le bouton est masqué. */
  stripeAvailable: boolean;
  /** CinetPay configuré côté serveur. */
  cinetpayAvailable: boolean;
}

type Psp = "stripe" | "cinetpay";

const initialState = { success: false } as { success: boolean; message?: string };

/**
 * Suggère le PSP par défaut en fonction de la devise :
 *   GNF / XOF → CinetPay obligatoire (Stripe ne supporte pas ces devises)
 *   EUR / USD → Stripe par défaut, CinetPay possible si l'utilisateur préfère
 *               Mobile Money (la diaspora qui paie en EUR via OM/MoMo).
 */
function defaultPsp(
  currency: Currency,
  stripeAvailable: boolean,
  cinetpayAvailable: boolean,
): Psp {
  if (currency === "GNF" || currency === "XOF") return "cinetpay";
  if (stripeAvailable) return "stripe";
  if (cinetpayAvailable) return "cinetpay";
  return "stripe";
}

async function dispatchCheckout(
  _prev: typeof initialState,
  formData: FormData,
): Promise<typeof initialState> {
  const psp = (formData.get("psp") ?? "stripe") as Psp;
  const result =
    psp === "cinetpay"
      ? await startCinetPayCheckout(formData)
      : await startCheckout(formData);
  return { success: result.success, message: result.message };
}

export function CartSummaryForm({
  subtotalCents,
  currency,
  affiliateActive,
  stripeAvailable,
  cinetpayAvailable,
}: CartSummaryFormProps) {
  const [state, formAction] = useActionState(dispatchCheckout, initialState);
  const [psp, setPsp] = useState<Psp>(() =>
    defaultPsp(currency, stripeAvailable, cinetpayAvailable),
  );
  // Pré-remplit le champ « Code promo » si l'utilisateur a validé un code
  // sur une page cours (clé `gandal:promo-code` posée par CourseCouponInput).
  // SSR-safe via useSyncExternalStore (serveur → null). L'override local prend
  // le relais dès que l'utilisateur tape, sans setState dans un effet.
  const storedPromo = useStoredValue("session", "gandal:promo-code") ?? "";
  const [promoOverride, setPromoOverride] = useState<string | null>(null);
  const promoCode = promoOverride ?? storedPromo;

  const stripeDisabled =
    !stripeAvailable || currency === "GNF" || currency === "XOF";
  const cinetpayDisabled = !cinetpayAvailable;

  // UUID v4 stable pour la durée du composant — un seul submit = une seule
  // commande, peu importe le nombre de clics. Initialiseur paresseux (exécuté
  // une fois) : crypto.randomUUID() est natif dans tous les navigateurs
  // modernes et Node 19+.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {affiliateActive ? (
        <p className="rounded-md border border-[color:var(--brand-success)]/30 bg-[color:var(--brand-success)]/10 px-3 py-2 text-xs text-foreground">
          Lien d&apos;affiliation actif — taux préférentiel de 15&nbsp;% sur les
          ventes éligibles.
        </p>
      ) : null}

      <FormField
        id="promoCode"
        label="Code promo"
        hint={
          promoCode
            ? "Code reporté depuis la page cours."
            : "Optionnel"
        }
      >
        <Input
          id="promoCode"
          name="promoCode"
          value={promoCode}
          onChange={(e) => setPromoOverride(e.target.value.toUpperCase())}
          placeholder="EX : BIENVENUE10"
          className="font-mono uppercase"
        />
      </FormField>

      <fieldset className="space-y-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          Mode de paiement
        </legend>
        <input type="hidden" name="psp" value={psp} />

        <label
          className={`flex cursor-pointer items-start gap-3 rounded-md p-2 transition ${
            psp === "stripe"
              ? "bg-[color:var(--brand-secondary)]/10 ring-1 ring-[color:var(--brand-secondary)]/40"
              : "hover:bg-muted/50"
          } ${stripeDisabled ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <input
            type="radio"
            name="psp-radio"
            value="stripe"
            checked={psp === "stripe"}
            disabled={stripeDisabled}
            onChange={() => setPsp("stripe")}
            className="mt-1"
          />
          <span className="flex-1">
            <span className="block text-sm font-medium text-foreground">
              Carte internationale (Stripe)
            </span>
            <span className="block text-xs text-muted-foreground">
              Visa, Mastercard, Apple Pay, Google Pay. Devises EUR / USD.
            </span>
          </span>
        </label>

        <label
          className={`flex cursor-pointer items-start gap-3 rounded-md p-2 transition ${
            psp === "cinetpay"
              ? "bg-[color:var(--brand-secondary)]/10 ring-1 ring-[color:var(--brand-secondary)]/40"
              : "hover:bg-muted/50"
          } ${cinetpayDisabled ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <input
            type="radio"
            name="psp-radio"
            value="cinetpay"
            checked={psp === "cinetpay"}
            disabled={cinetpayDisabled}
            onChange={() => setPsp("cinetpay")}
            className="mt-1"
          />
          <span className="flex-1">
            <span className="block text-sm font-medium text-foreground">
              Mobile Money &amp; carte locale (CinetPay)
            </span>
            <span className="block text-xs text-muted-foreground">
              Orange Money, MTN MoMo, Wave, carte bancaire locale. Guinée &amp;
              Afrique de l&apos;Ouest. Devises GNF / XOF / EUR / USD.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Sous-total</span>
        <span className="font-medium text-foreground">
          {formatPriceFromCents(subtotalCents, currency)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Les codes promo sont appliqués avant la redirection vers le prestataire
        de paiement. Aucune carte n&apos;est stockée chez nous.
      </p>

      {state.message && !state.success ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <SubmitButton
        className="w-full"
        pendingLabel={
          psp === "cinetpay"
            ? "Redirection vers CinetPay…"
            : "Redirection vers Stripe…"
        }
      >
        {psp === "cinetpay" ? "Payer avec Mobile Money" : "Payer par carte"}
      </SubmitButton>
      <Button
        type="reset"
        variant="link"
        className="h-auto px-0 text-xs text-muted-foreground"
      >
        Effacer le code promo
      </Button>
    </form>
  );
}
