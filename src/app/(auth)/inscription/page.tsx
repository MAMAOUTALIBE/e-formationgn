import type { Metadata } from "next";
import Link from "next/link";

import { GoogleButton } from "@/components/features/auth/google-button";
import { RegisterForm } from "@/components/features/auth/register-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Inscription",
  description: "Créez votre compte Gandal gratuitement.",
};

const hasGoogleProvider = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export default function InscriptionPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Créer un compte</CardTitle>
        <CardDescription>
          Rejoignez Gandal gratuitement. C&apos;est rapide.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasGoogleProvider ? (
          <>
            <GoogleButton />
            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs uppercase tracking-wide text-muted-foreground">
                ou avec votre email
              </span>
            </div>
          </>
        ) : null}

        <RegisterForm />

        <p className="text-center text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link href="/connexion" className="text-[color:var(--brand-secondary)] hover:underline">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
