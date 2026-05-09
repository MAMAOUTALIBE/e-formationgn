// Banner "Mode test" affiché en haut du site quand au moins un PSP est en
// mode test/sandbox. Server Component — pas de JS client nécessaire.
//
// Critères d'affichage (cf. lib/payments/payment-mode.ts) :
//   - Stripe configuré avec une clé sk_test_*
//   - OU CinetPay avec CINETPAY_MODE=test
//   - OU aucun PSP configuré (utile en local dev pour rappeler que les
//     paiements sont désactivés)

import { AlertTriangle } from "lucide-react";

import { getPaymentModeReport } from "@/lib/payments/payment-mode";

export function TestModeBanner() {
  const report = getPaymentModeReport();
  if (!report.showTestBanner) return null;

  const stripeNote = report.stripe.configured
    ? `Stripe (${report.stripe.mode})`
    : null;
  const cinetpayNote = report.cinetpay.configured
    ? `CinetPay (${report.cinetpay.mode})`
    : null;

  const message =
    !report.stripe.configured && !report.cinetpay.configured
      ? "Aucun fournisseur de paiement n'est configuré — les boutons d'achat sont désactivés."
      : `Mode test actif — aucune transaction réelle. Configuré : ${[
          stripeNote,
          cinetpayNote,
        ]
          .filter(Boolean)
          .join(" + ")}.`;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-amber-300/70 bg-amber-100 px-4 py-1.5 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="text-center">{message}</span>
    </div>
  );
}
