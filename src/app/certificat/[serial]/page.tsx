// Page publique de vérification d'un certificat.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Vérification de certificat",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

interface PageProps {
  params: Promise<{ serial: string }>;
}

export default async function VerifyCertificatePage({ params }: PageProps) {
  const { serial } = await params;
  const certificate = await prisma.certificate.findUnique({
    where: { serialNumber: serial },
    include: {
      user: { select: { name: true, firstName: true, lastName: true } },
      course: {
        select: {
          title: true,
          slug: true,
          instructor: {
            select: { name: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (!certificate) notFound();

  const recipientName =
    certificate.user.name ??
    ([certificate.user.firstName, certificate.user.lastName].filter(Boolean).join(" ") ||
      "Apprenant·e");
  const instructorName =
    certificate.course.instructor.name ??
    ([certificate.course.instructor.firstName, certificate.course.instructor.lastName]
      .filter(Boolean)
      .join(" ") ||
      "Formateur");

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-muted/20 py-12">
        <Container className="max-w-2xl">
          <Card>
            <CardHeader className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[color:var(--brand-success)]" />
              <CardTitle className="mt-2 text-2xl">Certificat authentique</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Référence : <code className="rounded bg-muted px-1">{certificate.serialNumber}</code>
              </p>
              <dl className="space-y-2">
                <div className="flex justify-between gap-4 border-b border-border pb-2">
                  <dt className="text-muted-foreground">Bénéficiaire</dt>
                  <dd className="font-medium text-foreground">{recipientName}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border pb-2">
                  <dt className="text-muted-foreground">Cours</dt>
                  <dd className="font-medium text-foreground">{certificate.course.title}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border pb-2">
                  <dt className="text-muted-foreground">Formateur</dt>
                  <dd className="font-medium text-foreground">{instructorName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Émis le</dt>
                  <dd className="font-medium text-foreground">
                    {dateFormatter.format(certificate.issuedAt)}
                  </dd>
                </div>
              </dl>
              <p className="rounded-md bg-[color:var(--brand-success)]/10 p-3 text-xs text-foreground">
                Ce certificat a été émis par E-FormationGN. Il atteste que la
                personne mentionnée a suivi avec succès l&apos;intégralité du
                cours indiqué.
              </p>
            </CardContent>
          </Card>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
