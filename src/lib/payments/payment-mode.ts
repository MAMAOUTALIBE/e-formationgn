import "server-only";

// Détection du mode de paiement (test / live) à partir des variables d'env.
//
// Stripe : convention universelle, les clés test commencent par `sk_test_`
//          et `pk_test_`, les clés live par `sk_live_` / `pk_live_`.
// CinetPay : pas de convention dans la clé elle-même → on lit la variable
//            explicite `CINETPAY_MODE` qui doit valoir "test" ou "live".

import {
  isCinetPayConfigured,
  CINETPAY_API_KEY,
} from "@/lib/payments/cinetpay";
import { isStripeConfigured } from "@/lib/stripe";

export type PaymentMode = "live" | "test" | "unknown";

export interface PaymentProviderStatus {
  configured: boolean;
  mode: PaymentMode;
}

export interface PaymentModeReport {
  stripe: PaymentProviderStatus;
  cinetpay: PaymentProviderStatus;
  /** True si AU MOINS un des PSP configurés tourne en mode test (ou si aucun
   *  PSP n'est configuré en local dev — pour signaler clairement à l'admin). */
  showTestBanner: boolean;
}

function stripeMode(): PaymentMode {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return "unknown";
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  return "unknown";
}

function cinetPayMode(): PaymentMode {
  if (!CINETPAY_API_KEY) return "unknown";
  const explicit = (process.env.CINETPAY_MODE ?? "").toLowerCase();
  if (explicit === "test") return "test";
  if (explicit === "live" || explicit === "production") return "live";
  // CinetPay propose un environnement sandbox via un site_id séparé. Sans
  // indicateur explicite, on suppose live (plus prudent : on alertera plutôt).
  return "live";
}

export function getPaymentModeReport(): PaymentModeReport {
  const stripe: PaymentProviderStatus = {
    configured: isStripeConfigured(),
    mode: stripeMode(),
  };
  const cinetpay: PaymentProviderStatus = {
    configured: isCinetPayConfigured(),
    mode: cinetPayMode(),
  };

  const stripeIsTest = stripe.configured && stripe.mode === "test";
  const cinetpayIsTest = cinetpay.configured && cinetpay.mode === "test";
  const noPspConfigured = !stripe.configured && !cinetpay.configured;

  return {
    stripe,
    cinetpay,
    showTestBanner: stripeIsTest || cinetpayIsTest || noPspConfigured,
  };
}
