import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { verifyEmailToken } from "@/server/actions/auth";

export const metadata: Metadata = {
  title: "Vérification de l'email",
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  // Sans token : page d'attente après inscription.
  if (!token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Vérifiez votre email</CardTitle>
          <CardDescription>
            Nous vous avons envoyé un lien de confirmation. Cliquez dessus pour activer votre compte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Pensez à vérifier votre dossier de courrier indésirable si vous ne trouvez pas l&apos;email.
          </p>
          <p>
            Vous pouvez fermer cette page ; le lien dans l&apos;email vous ramènera ici une fois cliqué.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/connexion">Retour à la connexion</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const result = await verifyEmailToken(token);

  if (result.status === "success" || result.status === "already-verified") {
    // On envoie l'utilisateur sur la page de connexion avec un message succès.
    redirect("/connexion?verifie=1");
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Lien invalide ou expiré</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            {result.status === "expired"
              ? "Ce lien de vérification a expiré. Contactez le centre pour recevoir de nouvelles instructions."
              : "Ce lien est invalide ou a déjà été utilisé."}
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/contact">Contacter le centre</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
