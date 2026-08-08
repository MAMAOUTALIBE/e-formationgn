import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/features/auth/reset-password-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Réinitialiser le mot de passe",
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle as="h1" className="text-2xl">Lien invalide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              Ce lien de réinitialisation est invalide. Veuillez en demander un nouveau.
            </AlertDescription>
          </Alert>
          <p className="text-center text-sm">
            <Link
              href="/mot-de-passe-oublie"
              className="text-[color:var(--brand-secondary)] hover:underline"
            >
              Demander un nouveau lien
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Nouveau mot de passe</CardTitle>
        <CardDescription>Choisissez un mot de passe robuste.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={token} />
      </CardContent>
    </Card>
  );
}
