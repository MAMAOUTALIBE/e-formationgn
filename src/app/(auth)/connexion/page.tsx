import type { Metadata } from "next";
import Link from "next/link";

import { GoogleButton } from "@/components/features/auth/google-button";
import { LoginForm } from "@/components/features/auth/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous à votre compte Gandal.",
};

const hasGoogleProvider = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

interface PageProps {
  searchParams: Promise<{ callbackUrl?: string; verifie?: string; reinitialise?: string }>;
}

export default async function ConnexionPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl;

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Bon retour</CardTitle>
        <CardDescription>Connectez-vous pour reprendre votre apprentissage.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {params.verifie === "1" ? (
          <Alert variant="success">
            <AlertDescription>
              Votre adresse email a été confirmée. Vous pouvez maintenant vous connecter.
            </AlertDescription>
          </Alert>
        ) : null}
        {params.reinitialise === "1" ? (
          <Alert variant="success">
            <AlertDescription>
              Votre mot de passe a bien été mis à jour. Connectez-vous avec vos nouveaux identifiants.
            </AlertDescription>
          </Alert>
        ) : null}

        {hasGoogleProvider ? (
          <>
            <GoogleButton callbackUrl={callbackUrl} />
            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs uppercase tracking-wide text-muted-foreground">
                ou avec votre email
              </span>
            </div>
          </>
        ) : null}

        <LoginForm callbackUrl={callbackUrl} />

        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="text-[color:var(--brand-secondary)] hover:underline">
            Créer un compte
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
