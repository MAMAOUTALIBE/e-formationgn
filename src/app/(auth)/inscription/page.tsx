import type { Metadata } from "next";
import Link from "next/link";

import { GoogleButton } from "@/components/features/auth/google-button";
import { RegisterForm } from "@/components/features/auth/register-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { isTrainingCenterMode } from "@/lib/platform-mode";

export const metadata: Metadata = {
  title: "Inscription",
  description: "Créez votre compte Aiduca gratuitement.",
};

const hasGoogleProvider = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export default function InscriptionPage() {
  // Mode centre de formation : les comptes sont créés depuis le CRM. On
  // explique la marche à suivre au lieu d'afficher un formulaire que l'action
  // serveur refuserait de toute façon.
  if (isTrainingCenterMode()) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle as="h1" className="text-2xl">Accès réservé</CardTitle>
          <CardDescription>
            Les comptes sont créés par le centre de formation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Il n&apos;est pas possible de s&apos;inscrire soi-même. Rapprochez-vous
            du secrétariat : vos identifiants vous seront transmis par email dès
            votre inscription enregistrée.
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Vous avez déjà vos identifiants ?{" "}
            <Link
              href="/connexion"
              className="text-[color:var(--brand-secondary)] hover:underline"
            >
              Se connecter
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Créer un compte</CardTitle>
        <CardDescription>
          Rejoignez Aiduca gratuitement. C&apos;est rapide.
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
