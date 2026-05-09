import "server-only";

// Wrapper CinetPay — pour les paiements Mobile Money + cartes locales en
// Afrique de l'Ouest (Guinée GNF, Côte d'Ivoire/Sénégal/Mali XOF, etc.).
//
// Doc API : https://docs.cinetpay.com
//
// Flux global :
//   1. /payment : on POST init transaction → reçoit payment_url
//   2. Utilisateur paie sur la page CinetPay (Mobile Money, carte…)
//   3. CinetPay POST notre IPN webhook avec status final
//   4. On vérifie côté serveur via /payment/check → marque l'Order PAID
//
// Notes :
//   - Le `transaction_id` envoyé est notre `Order.id` — assure idempotence.
//   - Toujours re-vérifier via /check côté serveur (jamais faire confiance
//     uniquement au callback navigateur).

import { createHmac, timingSafeEqual } from "node:crypto";

const CINETPAY_API_BASE = "https://api-checkout.cinetpay.com/v2";

export const CINETPAY_API_KEY = process.env.CINETPAY_API_KEY;
export const CINETPAY_SITE_ID = process.env.CINETPAY_SITE_ID;
export const CINETPAY_SECRET_KEY = process.env.CINETPAY_SECRET_KEY;

export function isCinetPayConfigured(): boolean {
  return Boolean(CINETPAY_API_KEY && CINETPAY_SITE_ID && CINETPAY_SECRET_KEY);
}

// Devises supportées côté CinetPay pour notre cible (Guinée + zone CFA).
export type CinetPayCurrency = "XOF" | "XAF" | "CDF" | "GNF" | "USD" | "EUR";

// ---------------------------------------------------------------------------
// Init transaction (étape 1 du flux)
// ---------------------------------------------------------------------------

export interface CinetPayInitParams {
  /** Notre Order.id — utilisé comme transaction_id côté CinetPay. */
  transactionId: string;
  /** Montant TOTAL à payer (unité entière : 5000 GNF = 5000). Pas de centimes. */
  amount: number;
  /** Devise. CinetPay rejette si combinaison amount/currency invalide. */
  currency: CinetPayCurrency;
  /** Description courte affichée à l'utilisateur. Max ~191 chars. */
  description: string;
  /** URL où l'utilisateur revient après paiement (succès ou échec). */
  returnUrl: string;
  /** URL côté serveur où CinetPay POST le statut final (IPN). */
  notifyUrl: string;
  /** Identifiant interne du client (Order.userId). Sert au rapprochement. */
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  /** Restreint les modes (ex: ["MOBILE_MONEY"]) — sinon CinetPay propose tout. */
  channels?: Array<"MOBILE_MONEY" | "CREDIT_CARD" | "WALLET" | "ALL">;
  /** Pays par défaut affiché (GN = Guinée). */
  customerCountry?: string;
}

export interface CinetPayInitResponse {
  paymentUrl: string;
  /** ID interne CinetPay — différent de notre transactionId. */
  paymentToken?: string;
  /** Réponse brute pour debug / log. */
  raw: unknown;
}

export class CinetPayError extends Error {
  readonly code: string;
  readonly raw: unknown;

  constructor(code: string, message: string, raw: unknown) {
    super(message);
    this.name = "CinetPayError";
    this.code = code;
    this.raw = raw;
  }
}

interface CinetPayApiResponse {
  code?: string;
  message?: string;
  description?: string;
  data?: {
    payment_url?: string;
    payment_token?: string;
    api_response_id?: string;
    [key: string]: unknown;
  };
  api_response_id?: string;
}

export async function initTransaction(
  params: CinetPayInitParams,
): Promise<CinetPayInitResponse> {
  if (!isCinetPayConfigured()) {
    throw new CinetPayError(
      "NOT_CONFIGURED",
      "CinetPay non configuré (CINETPAY_* manquants).",
      null,
    );
  }

  const body = {
    apikey: CINETPAY_API_KEY,
    site_id: CINETPAY_SITE_ID,
    transaction_id: params.transactionId,
    amount: params.amount,
    currency: params.currency,
    description: params.description.slice(0, 190),
    return_url: params.returnUrl,
    notify_url: params.notifyUrl,
    channels: (params.channels ?? ["ALL"]).join(","),
    customer_id: params.customerId,
    customer_name: params.customerName?.slice(0, 80),
    customer_email: params.customerEmail,
    customer_phone_number: params.customerPhone,
    customer_country: params.customerCountry ?? "GN",
    metadata: JSON.stringify({ orderId: params.transactionId }),
  };

  const response = await fetch(`${CINETPAY_API_BASE}/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new CinetPayError(
      "HTTP_" + response.status,
      `CinetPay HTTP ${response.status}`,
      text,
    );
  }

  const data = (await response.json()) as CinetPayApiResponse;
  if (data.code !== "201") {
    throw new CinetPayError(
      data.code ?? "UNKNOWN",
      data.message ?? data.description ?? "Erreur CinetPay",
      data,
    );
  }

  const paymentUrl = data.data?.payment_url;
  if (!paymentUrl) {
    throw new CinetPayError(
      "NO_PAYMENT_URL",
      "Réponse CinetPay sans payment_url",
      data,
    );
  }

  return {
    paymentUrl,
    paymentToken: data.data?.payment_token,
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// Vérification côté serveur (étape 4 — appelée depuis le webhook)
// ---------------------------------------------------------------------------

export interface CinetPayCheckResult {
  /** Statut canonique. */
  status: "ACCEPTED" | "REFUSED" | "PENDING";
  /** Montant confirmé par CinetPay (en unité entière, devise CinetPay). */
  amount?: number;
  currency?: string;
  /** Mode de paiement réel (OM_GN, MTN_GN, CARD…). */
  paymentMethod?: string;
  /** Phone payeur si Mobile Money. */
  phoneNumber?: string;
  /** Nom payeur si fourni. */
  operatorId?: string;
  raw: unknown;
}

interface CinetPayCheckApiResponse {
  code?: string;
  message?: string;
  data?: {
    amount?: number;
    currency?: string;
    status?: string; // "ACCEPTED" | "REFUSED" | "PENDING" | autre
    payment_method?: string;
    payment_date?: string;
    description?: string;
    metadata?: string;
    operator_id?: string;
    payment_phone_number?: string;
    [key: string]: unknown;
  };
}

export async function checkTransaction(
  transactionId: string,
): Promise<CinetPayCheckResult> {
  if (!isCinetPayConfigured()) {
    throw new CinetPayError("NOT_CONFIGURED", "CinetPay non configuré.", null);
  }

  const body = {
    apikey: CINETPAY_API_KEY,
    site_id: CINETPAY_SITE_ID,
    transaction_id: transactionId,
  };

  const response = await fetch(`${CINETPAY_API_BASE}/payment/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new CinetPayError(
      "HTTP_" + response.status,
      `CinetPay check HTTP ${response.status}`,
      await response.text(),
    );
  }

  const data = (await response.json()) as CinetPayCheckApiResponse;
  // CinetPay renvoie code "00" pour succès du check (la transaction existe).
  // Le statut réel est dans data.data.status.
  const rawStatus = (data.data?.status ?? "").toUpperCase();
  const status: CinetPayCheckResult["status"] =
    rawStatus === "ACCEPTED"
      ? "ACCEPTED"
      : rawStatus === "REFUSED" || rawStatus === "CANCELLED" || rawStatus === "FAILED"
        ? "REFUSED"
        : "PENDING";

  return {
    status,
    amount: data.data?.amount,
    currency: data.data?.currency,
    paymentMethod: data.data?.payment_method,
    phoneNumber: data.data?.payment_phone_number,
    operatorId: data.data?.operator_id,
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// Vérification du token IPN (signature x-token)
// ---------------------------------------------------------------------------

/**
 * CinetPay envoie un en-tête `x-token` calculé comme HMAC-SHA256 du body
 * brut signé avec le secret. On compare en temps constant.
 * Voir : https://docs.cinetpay.com/api/1.0-en/checkout/notification.html
 *
 * NOTE : selon la version de l'API, certains comptes signent en SHA256(body+secret)
 * et d'autres en HMAC-SHA256(secret, body). On essaie HMAC d'abord (standard),
 * et on bascule si CinetPay l'exige autrement (à ajuster côté config compte).
 */
export function verifyIpnSignature(
  rawBody: string,
  receivedToken: string | null,
): boolean {
  if (!CINETPAY_SECRET_KEY || !receivedToken) return false;

  const expected = createHmac("sha256", CINETPAY_SECRET_KEY)
    .update(rawBody, "utf8")
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(receivedToken);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
