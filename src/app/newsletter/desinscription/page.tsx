// Page de désinscription newsletter — accessible publiquement via le
// token unique inclus dans chaque email. Pas d'auth requise, idempotente.
//
// L'action de désinscription tourne au render (pattern React Server
// Actions « action implicite au mount ») et le résultat est affiché.
// Conforme RGPD : un seul clic depuis l'email, pas de friction.

import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MailX, XCircle } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { unsubscribeNewsletterByToken } from "@/server/actions/newsletter";

export const metadata: Metadata = {
  title: "Désinscription newsletter",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function NewsletterUnsubscribePage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const result = token
    ? await unsubscribeNewsletterByToken(token)
    : { ok: false, message: "Lien de désinscription manquant." };

  const Icon = result.ok ? CheckCircle2 : XCircle;
  const iconColor = result.ok
    ? "text-[color:var(--brand-success)]"
    : "text-[color:var(--brand-danger)]";

  return (
    <>
      <SiteHeader />

      <main className="flex-1 bg-muted/20 py-12">
        <Container>
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <MailX className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
              Désinscription newsletter
            </h1>

            <div
              className={`mt-6 flex items-start gap-3 rounded-md p-4 text-left text-sm ${
                result.ok
                  ? "border border-[color:var(--brand-success)]/30 bg-[color:var(--brand-success)]/5"
                  : "border border-[color:var(--brand-danger)]/30 bg-[color:var(--brand-danger)]/5"
              }`}
              role="status"
            >
              <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} aria-hidden />
              <div>
                <p className="font-medium text-foreground">{result.message}</p>
                {result.ok && result.emailMasked ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Adresse concernée :{" "}
                    <code className="text-foreground">{result.emailMasked}</code>
                  </p>
                ) : null}
              </div>
            </div>

            {result.ok ? (
              <p className="mt-6 text-xs text-muted-foreground">
                Vous pouvez à tout moment vous réinscrire depuis le pied de page
                du site.
              </p>
            ) : (
              <p className="mt-6 text-xs text-muted-foreground">
                Si le problème persiste, contactez le support en précisant le
                token suspect (ne le partagez pas publiquement).
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="outline">
                <Link href="/">Retour à l&apos;accueil</Link>
              </Button>
              {!result.ok ? (
                <Button asChild variant="ghost">
                  <Link href="/contact">Contacter le support</Link>
                </Button>
              ) : null}
            </div>
          </div>
        </Container>
      </main>

      <SiteFooter />
    </>
  );
}
