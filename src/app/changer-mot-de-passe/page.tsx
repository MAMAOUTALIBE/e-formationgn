import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { FirstPasswordForm } from "@/components/features/auth/first-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Changer votre mot de passe" };

export const dynamic = "force-dynamic";

/**
 * Écran imposé au premier accès pour les comptes créés par le centre.
 *
 * Volontairement hors du groupe (auth) : ces routes-là redirigent les
 * utilisateurs connectés vers l'accueil, ce qui rendrait cette page — qui
 * s'adresse précisément à un utilisateur connecté — inatteignable.
 */
export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion?callbackUrl=/changer-mot-de-passe");

  // Accès direct alors que rien n'est exigé : rien à faire ici.
  if (!session.user.mustChangePassword) redirect("/");

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Choisissez votre mot de passe</CardTitle>
          <CardDescription>
            Votre compte a été créé par le centre de formation avec un mot de
            passe provisoire. Remplacez-le pour accéder à vos formations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FirstPasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
