import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPaymentModeReport } from "@/lib/payments/payment-mode";

export const metadata: Metadata = { title: "Paiements" };

const PRIVATE_NO_STORE_HEADERS_DOC =
  "Ces données sont sensibles : la page n'est jamais mise en cache (Cache-Control par défaut côté admin).";

export default function PaymentsSettingsPage() {
  const report = getPaymentModeReport();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Paiements
        </h1>
        <p className="text-sm text-muted-foreground">
          Statut des prestataires de paiement (PSP) configurés. Stripe pour
          les cartes internationales (EUR/USD), CinetPay pour Mobile Money
          et cartes locales (GNF/XOF/EUR/USD).
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <ProviderCard
          name="Stripe"
          tagline="Cartes internationales (Visa, Mastercard, Apple Pay…)"
          devises="EUR, USD"
          configured={report.stripe.configured}
          mode={report.stripe.mode}
          docHref="https://dashboard.stripe.com/test/apikeys"
          envVars={[
            "STRIPE_SECRET_KEY (sk_test_… ou sk_live_…)",
            "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_… ou pk_live_…)",
            "STRIPE_WEBHOOK_SECRET (whsec_…)",
            "STRIPE_CONNECT_CLIENT_ID (optionnel)",
          ]}
        />

        <ProviderCard
          name="CinetPay"
          tagline="Mobile Money (Orange Money, MTN MoMo, Wave) + carte locale"
          devises="GNF, XOF, EUR, USD"
          configured={report.cinetpay.configured}
          mode={report.cinetpay.mode}
          docHref="https://www.cinetpay.com"
          envVars={[
            "CINETPAY_API_KEY",
            "CINETPAY_SITE_ID",
            "CINETPAY_SECRET_KEY",
            "CINETPAY_MODE (test | live — par défaut live)",
          ]}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">URL des webhooks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            À renseigner côté tableau de bord de chaque PSP. Notre application
            valide la signature à chaque réception.
          </p>
          <div className="space-y-2">
            <div>
              <p className="font-medium text-foreground">Stripe</p>
              <code className="block break-all rounded bg-muted px-2 py-1 text-xs">
                {appUrl()}/api/webhooks/stripe
              </code>
              <p className="mt-1 text-xs text-muted-foreground">
                Events : checkout.session.completed, payment_intent.*,
                charge.refunded, charge.dispute.*, account.updated, payout.*
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">CinetPay (IPN)</p>
              <code className="block break-all rounded bg-muted px-2 py-1 text-xs">
                {appUrl()}/api/webhooks/cinetpay
              </code>
              <p className="mt-1 text-xs text-muted-foreground">
                Validation x-token HMAC-SHA256 + double-check via /payment/check.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cartes de test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Utilisables uniquement quand le PSP est en mode test/sandbox.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">Stripe — Visa réussie</p>
              <code className="text-sm">4242 4242 4242 4242</code>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Expiration future, CVC quelconque (123). Pas d&apos;authentification 3-D Secure.
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">Stripe — Visa déclinée</p>
              <code className="text-sm">4000 0000 0000 9995</code>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Simule un paiement refusé (insufficient_funds).
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">CinetPay — sandbox</p>
              <code className="text-sm">via dashboard test</code>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Voir CinetPay → environnement de test → numéros Mobile Money fictifs.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-foreground">
            <li>
              <Link
                href="https://github.com/MAMAOUTALIBE/e-formationgn/blob/main/PAYMENTS.md"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                PAYMENTS.md — flux paiement & devises
              </Link>
            </li>
            <li>
              <Link
                href="https://github.com/MAMAOUTALIBE/e-formationgn/blob/main/PAYMENTS-TEST.md"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                PAYMENTS-TEST.md — guide environnement de test
              </Link>
            </li>
          </ul>
          <p className="text-xs text-muted-foreground">
            {PRIVATE_NO_STORE_HEADERS_DOC}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://votre-domaine";
}

interface ProviderCardProps {
  name: string;
  tagline: string;
  devises: string;
  configured: boolean;
  mode: "live" | "test" | "unknown";
  docHref: string;
  envVars: string[];
}

function ProviderCard({
  name,
  tagline,
  devises,
  configured,
  mode,
  docHref,
  envVars,
}: ProviderCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{name}</span>
          <StatusBadge configured={configured} mode={mode} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{tagline}</p>
        <p className="text-xs text-muted-foreground">
          Devises : <span className="font-mono text-foreground">{devises}</span>
        </p>
        <div>
          <p className="text-xs font-medium text-foreground">Variables d&apos;env</p>
          <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-muted-foreground">
            {envVars.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </div>
        <Link
          href={docHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs underline"
        >
          Dashboard {name} →
        </Link>
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  configured,
  mode,
}: {
  configured: boolean;
  mode: "live" | "test" | "unknown";
}) {
  if (!configured) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <XCircle className="h-3 w-3" /> Non configuré
      </span>
    );
  }
  if (mode === "test") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertCircle className="h-3 w-3" /> Test
      </span>
    );
  }
  if (mode === "live") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        <CheckCircle2 className="h-3 w-3" /> Live
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      Inconnu
    </span>
  );
}
