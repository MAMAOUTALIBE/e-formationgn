import type { Metadata } from "next";
import Link from "next/link";

import { RequestResetForm } from "@/components/features/auth/request-reset-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
  description: "Recevez par email un lien pour réinitialiser votre mot de passe.",
};

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle as="h1" className="text-2xl">Mot de passe oublié</CardTitle>
        <CardDescription>
          Saisissez votre adresse email pour recevoir un lien de réinitialisation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RequestResetForm />

        <p className="text-center text-sm text-muted-foreground">
          Pas besoin finalement ?{" "}
          <Link href="/connexion" className="text-[color:var(--brand-secondary)] underline underline-offset-4 hover:no-underline">
            Retour à la connexion
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
