import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Accès réservé",
  description: "Les comptes Aiduca sont créés par le centre de formation.",
  robots: { index: false, follow: false },
};

export default function RegistrationAccessPage() {
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
          La création libre de compte n&apos;est pas disponible. Si votre inscription à une
          formation a été validée, le centre vous communiquera vos informations d&apos;accès.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/connexion">Se connecter</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contact">Contacter le centre</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
