import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { auth } from "@/auth";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Accès formateur",
  description: "Accès réservé aux formateurs habilités par AIDUCA.",
  alternates: { canonical: "/devenir-formateur" },
  robots: { index: false, follow: false },
};

export default async function InstructorAccessPage() {
  const session = await auth();

  if (session?.user.role === "INSTRUCTOR" || session?.user.role === "ADMIN") {
    redirect("/formateur");
  }

  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center py-16">
        <Container className="max-w-xl">
          <Card>
            <CardHeader className="items-center text-center">
              <span className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--brand-primary)]/10 text-[color:var(--brand-primary)]">
                <LockKeyhole className="h-6 w-6" aria-hidden />
              </span>
              <CardTitle>Accès formateur réservé</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 text-center">
              <p className="text-sm text-muted-foreground">
                Cet espace est réservé aux formateurs dont le compte a été créé et habilité
                par AIDUCA. Il n&apos;est pas possible de demander ou d&apos;activer ce rôle en ligne.
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
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
