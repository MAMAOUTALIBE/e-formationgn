import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cinetPayAmountFromMinor,
  validateCinetPayAcceptedPayment,
} from "../../src/lib/payments/cinetpay-validation";

const order = { id: "order_123", totalCents: 25_000, currency: "GNF" as const, siteId: "site_1" };
const accepted = {
  status: "ACCEPTED" as const,
  transactionId: order.id,
  amount: 25_000,
  currency: "GNF",
  siteId: "site_1",
  metadata: JSON.stringify({ orderId: order.id }),
};

describe("validateCinetPayAcceptedPayment", () => {
  it("accepte un paiement exactement conforme", () => {
    assert.deepEqual(validateCinetPayAcceptedPayment(accepted, order), { ok: true });
  });

  it("refuse un montant divergent", () => {
    assert.deepEqual(
      validateCinetPayAcceptedPayment({ ...accepted, amount: 1 }, order),
      { ok: false, reason: "amount" },
    );
  });

  it("refuse une devise divergente", () => {
    assert.deepEqual(
      validateCinetPayAcceptedPayment({ ...accepted, currency: "XOF" }, order),
      { ok: false, reason: "currency" },
    );
  });

  it("refuse une transaction divergente", () => {
    assert.deepEqual(
      validateCinetPayAcceptedPayment({ ...accepted, transactionId: "other" }, order),
      { ok: false, reason: "transaction_id" },
    );
  });

  it("refuse un site ou metadata divergents lorsqu'ils sont retournés", () => {
    assert.deepEqual(
      validateCinetPayAcceptedPayment({ ...accepted, siteId: "other" }, order),
      { ok: false, reason: "site_id" },
    );
    assert.deepEqual(
      validateCinetPayAcceptedPayment(
        { ...accepted, metadata: JSON.stringify({ orderId: "other" }) },
        order,
      ),
      { ok: false, reason: "metadata" },
    );
  });

  it("utilise la même conversion PSP que l'initialisation", () => {
    assert.equal(cinetPayAmountFromMinor(1_999, "EUR"), 20);
    assert.equal(cinetPayAmountFromMinor(25_000, "GNF"), 25_000);
  });
});
