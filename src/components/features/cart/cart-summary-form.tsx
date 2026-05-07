"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatPriceFromCents } from "@/lib/money";
import { startCheckout } from "@/server/actions/checkout";
import type { Currency } from "@/generated/prisma/enums";

interface CartSummaryFormProps {
  subtotalCents: number;
  currency: Currency;
  affiliateActive: boolean;
}

const initialState = { success: false } as { success: boolean; message?: string };

async function startCheckoutWrapped(
  _prev: typeof initialState,
  formData: FormData,
): Promise<typeof initialState> {
  const result = await startCheckout(formData);
  return { success: result.success, message: result.message };
}

export function CartSummaryForm({
  subtotalCents,
  currency,
  affiliateActive,
}: CartSummaryFormProps) {
  const [state, formAction] = useActionState(startCheckoutWrapped, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {affiliateActive ? (
        <p className="rounded-md border border-[color:var(--brand-success)]/30 bg-[color:var(--brand-success)]/10 px-3 py-2 text-xs text-foreground">
          Lien d&apos;affiliation actif — taux préférentiel de 15&nbsp;% sur les
          ventes éligibles.
        </p>
      ) : null}

      <FormField
        id="promoCode"
        label="Code promo"
        hint="Optionnel"
      >
        <Input id="promoCode" name="promoCode" placeholder="EX : BIENVENUE10" />
      </FormField>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Sous-total</span>
        <span className="font-medium text-foreground">
          {formatPriceFromCents(subtotalCents, currency)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Le code promo sera appliqué et le prix final affiché par Stripe avant le paiement.
      </p>

      {state.message && !state.success ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <SubmitButton className="w-full" pendingLabel="Redirection vers Stripe…">
        Procéder au paiement
      </SubmitButton>
      <Button type="reset" variant="link" className="h-auto px-0 text-xs text-muted-foreground">
        Effacer le code promo
      </Button>
    </form>
  );
}
