import type { Currency } from "@/generated/prisma/enums";

export interface CinetPayAcceptedVerdict {
  status: "ACCEPTED" | "REFUSED" | "PENDING";
  transactionId?: string;
  amount?: number;
  currency?: string;
  siteId?: string;
  metadata?: string;
}

export interface CinetPayOrderExpectation {
  id: string;
  totalCents: number;
  currency: Currency;
  siteId?: string;
}

export type CinetPayValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "status"
        | "transaction_id"
        | "amount"
        | "currency"
        | "site_id"
        | "metadata";
    };

/** Montant entier transmis à CinetPay lors de l'initialisation. */
export function cinetPayAmountFromMinor(totalCents: number, currency: Currency): number {
  return currency === "EUR" || currency === "USD"
    ? Math.round(totalCents / 100)
    : totalCents;
}

function metadataOrderId(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const orderId = (parsed as { orderId?: unknown }).orderId;
    return typeof orderId === "string" ? orderId : null;
  } catch {
    return null;
  }
}

/**
 * Compare un verdict ACCEPTED au snapshot immuable de la commande. Les champs
 * optionnels retournés par certains comptes CinetPay sont contrôlés dès
 * qu'ils sont présents ; transaction, montant et devise restent obligatoires.
 */
export function validateCinetPayAcceptedPayment(
  verdict: CinetPayAcceptedVerdict,
  order: CinetPayOrderExpectation,
): CinetPayValidationResult {
  if (verdict.status !== "ACCEPTED") return { ok: false, reason: "status" };
  if (verdict.transactionId !== order.id) {
    return { ok: false, reason: "transaction_id" };
  }
  if (
    typeof verdict.amount !== "number" ||
    !Number.isFinite(verdict.amount) ||
    verdict.amount !== cinetPayAmountFromMinor(order.totalCents, order.currency)
  ) {
    return { ok: false, reason: "amount" };
  }
  if (verdict.currency?.toUpperCase() !== order.currency) {
    return { ok: false, reason: "currency" };
  }
  if (verdict.siteId !== undefined && verdict.siteId !== order.siteId) {
    return { ok: false, reason: "site_id" };
  }
  if (verdict.metadata !== undefined && metadataOrderId(verdict.metadata) !== order.id) {
    return { ok: false, reason: "metadata" };
  }
  return { ok: true };
}
