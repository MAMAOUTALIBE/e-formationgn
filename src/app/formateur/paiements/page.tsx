import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, Download, ExternalLink, Wallet } from "lucide-react";

import { auth } from "@/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isStripeConfigured } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import {
  createInstructorOnboardingLink,
  openInstructorDashboardLink,
  refreshInstructorAccountStatus,
} from "@/server/actions/connect";

export const metadata: Metadata = {
  title: "Paiements",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ refresh?: string; return?: string }>;
}

export default async function InstructorPayoutsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/formateur/paiements");
  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN") {
    redirect("/devenir-formateur");
  }

  // Si on revient de Stripe (return=1), on rafraîchit le statut.
  if (params.return === "1" && isStripeConfigured()) {
    try {
      await refreshInstructorAccountStatus();
    } catch (error) {
      console.warn("[connect] refresh failed", error);
    }
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      stripeAccountId: true,
      stripeAccountStatus: true,
      stripeOnboardingDone: true,
    },
  });

  const hasAccount = Boolean(dbUser?.stripeAccountId);
  const ready = Boolean(dbUser?.stripeOnboardingDone);

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Paiements</h1>
          <p className="text-sm text-muted-foreground">
            Configurez votre compte pour recevoir vos revenus directement de Stripe.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/api/formateur/ventes" download>
            <Download className="h-4 w-4" />
            Exporter mes ventes (CSV)
          </a>
        </Button>
      </header>

      {!isStripeConfigured() ? (
        <Alert variant="destructive">
          <AlertDescription>
            Stripe n&apos;est pas configuré sur la plateforme. Renseignez{" "}
            <code className="rounded bg-muted px-1">STRIPE_SECRET_KEY</code>{" "}
            puis redémarrez le serveur.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-5 w-5" aria-hidden />
              Compte Stripe Connect
            </CardTitle>
            <CardDescription>
              {ready
                ? "Votre compte est actif. Les versements arrivent automatiquement."
                : hasAccount
                  ? "Onboarding démarré — finalisez vos informations pour activer les versements."
                  : "Aucun compte Stripe associé."}
            </CardDescription>
          </div>
          {ready ? (
            <CheckCircle2 className="h-5 w-5 text-[color:var(--brand-success)]" aria-hidden />
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {params.refresh === "1" ? (
            <Alert variant="info">
              <AlertDescription>
                Vous avez interrompu l&apos;onboarding. Vous pouvez le reprendre
                quand vous le souhaitez.
              </AlertDescription>
            </Alert>
          ) : null}

          {!hasAccount ? (
            <form
              action={async () => {
                "use server";
                await createInstructorOnboardingLink();
              }}
            >
              <Button type="submit" disabled={!isStripeConfigured()}>
                Configurer mes paiements
              </Button>
            </form>
          ) : !ready ? (
            <div className="flex flex-wrap gap-2">
              <form
                action={async () => {
                  "use server";
                  await createInstructorOnboardingLink();
                }}
              >
                <Button type="submit">Continuer l&apos;onboarding Stripe</Button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await refreshInstructorAccountStatus();
                }}
              >
                <Button type="submit" variant="outline">
                  Rafraîchir le statut
                </Button>
              </form>
            </div>
          ) : (
            <form
              action={async () => {
                "use server";
                await openInstructorDashboardLink();
              }}
            >
              <Button type="submit" variant="outline">
                <ExternalLink className="h-4 w-4" />
                Ouvrir mon tableau de bord Stripe
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comment ça fonctionne</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Quand un élève achète l&apos;un de vos cours, la plateforme encaisse
            le paiement, puis vous reverse votre part — diminuée de la
            commission — directement sur votre compte Stripe Connect.
          </p>
          <p>
            <strong className="text-foreground">Commissions appliquées :</strong>{" "}
            15&nbsp;% pour les ventes que vous générez vous-même via votre lien
            d&apos;affiliation, 30&nbsp;% pour les ventes générées par la
            plateforme.
          </p>
          <p>
            Stripe gère le calendrier de versements (par défaut : J+7 en France)
            et la conformité KYC.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
