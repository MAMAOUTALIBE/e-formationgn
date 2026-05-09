// Vérifie la configuration des PSP (Stripe + CinetPay) en pingant les APIs.
// Ne crée AUCUNE transaction. Affiche un rapport lisible humain.
//
// Usage : npm run check:payments
// Ou    : npx tsx scripts/check-payments.ts

import "dotenv/config";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const BOLD = "\x1b[1m";

function ok(msg: string) {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}
function warn(msg: string) {
  console.log(`${YELLOW}⚠${RESET} ${msg}`);
}
function fail(msg: string) {
  console.log(`${RED}✗${RESET} ${msg}`);
}
function header(msg: string) {
  console.log(`\n${BOLD}${BLUE}── ${msg} ──${RESET}`);
}

async function checkStripe(): Promise<{ pass: boolean }> {
  header("Stripe");
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) {
    warn("STRIPE_SECRET_KEY absent — Stripe désactivé.");
    return { pass: true };
  }
  const mode = sk.startsWith("sk_test_")
    ? "test"
    : sk.startsWith("sk_live_")
      ? "live"
      : "unknown";
  if (mode === "unknown") {
    fail(`STRIPE_SECRET_KEY ne ressemble pas à une clé Stripe (préfixe sk_test_ / sk_live_).`);
    return { pass: false };
  }
  ok(`STRIPE_SECRET_KEY ${mode === "test" ? "TEST" : "LIVE"} (sk_${mode}_…)`);

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    warn("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY absent — UI client ne pourra pas charger Stripe.js.");
  } else {
    ok("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY présent.");
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    warn("STRIPE_WEBHOOK_SECRET absent — les webhooks renverront 500. Lance `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.");
  } else {
    ok("STRIPE_WEBHOOK_SECRET présent.");
  }

  // Ping API : récupère le compte
  try {
    const response = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${sk}` },
    });
    if (!response.ok) {
      fail(`Stripe API HTTP ${response.status} (clé invalide ?).`);
      return { pass: false };
    }
    const data = (await response.json()) as { id?: string; country?: string };
    ok(`Stripe API joignable — compte ${data.id ?? "?"} (${data.country ?? "?"}).`);
    return { pass: true };
  } catch (error) {
    fail(`Stripe API injoignable : ${String(error)}`);
    return { pass: false };
  }
}

async function checkCinetPay(): Promise<{ pass: boolean }> {
  header("CinetPay");
  const apiKey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  const secret = process.env.CINETPAY_SECRET_KEY;
  const mode = (process.env.CINETPAY_MODE ?? "live").toLowerCase();

  if (!apiKey || !siteId || !secret) {
    warn("CINETPAY_API_KEY / SITE_ID / SECRET_KEY incomplet — CinetPay désactivé.");
    return { pass: true };
  }
  ok(`Configuration trouvée — mode ${mode === "test" ? "TEST" : "LIVE"}.`);

  // Pas d'endpoint "ping" public CinetPay. On valide la clé en faisant un
  // call /payment/check avec un transaction_id factice — devrait renvoyer
  // une erreur "transaction non trouvée" mais code HTTP 200 + auth OK.
  try {
    const response = await fetch(
      "https://api-checkout.cinetpay.com/v2/payment/check",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apikey: apiKey,
          site_id: siteId,
          transaction_id: "gandal_check_payments_probe",
        }),
      },
    );
    if (response.status >= 500) {
      fail(`CinetPay API HTTP ${response.status} (service down ?).`);
      return { pass: false };
    }
    const data = (await response.json()) as {
      code?: string;
      message?: string;
    };
    if (data.code === "AUTH_NOT_FOUND" || data.code === "INVALID_AUTH") {
      fail(`CinetPay refuse l'authentification (${data.code} : ${data.message}).`);
      return { pass: false };
    }
    ok(`CinetPay API joignable — auth acceptée (réponse : ${data.code ?? "?"}).`);
    return { pass: true };
  } catch (error) {
    fail(`CinetPay API injoignable : ${String(error)}`);
    return { pass: false };
  }
}

async function main() {
  console.log(`${BOLD}Gandal — vérification config paiements${RESET}`);
  const a = await checkStripe();
  const b = await checkCinetPay();
  console.log("");
  if (a.pass && b.pass) {
    ok("Configuration OK.");
    process.exit(0);
  }
  fail("Configuration incomplète — corriger ci-dessus.");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
