import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  PercentCircle,
  PlayCircle,
  Users,
} from "lucide-react";

import { auth } from "@/auth";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { becomeInstructor } from "@/server/actions/instructor";

export const metadata: Metadata = {
  title: "Devenir formateur",
  description:
    "Créez des cours structurés et accompagnez les apprenants tout au long de leur progression.",
  alternates: { canonical: "/devenir-formateur" },
};

export default async function BecomeInstructorPage() {
  const session = await auth();

  // Si déjà formateur, redirection directe vers le dashboard.
  if (session?.user.role === "INSTRUCTOR" || session?.user.role === "ADMIN") {
    redirect("/formateur");
  }

  const isLoggedIn = Boolean(session?.user);
  const isVerified = Boolean(session?.user.emailVerified);

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        <section className="border-b border-border bg-[color:var(--brand-primary)] py-16 text-primary-foreground">
          <Container className="text-center">
            <p className="text-xs uppercase tracking-wider text-primary-foreground/70">
              Programme formateur
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              Partagez votre expertise
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-primary-foreground/80">
              Créez des cours structurés, animez vos formations et accompagnez
              les apprenants tout au long de leur progression.
            </p>

            <form
              action={async () => {
                "use server";
                await becomeInstructor();
              }}
              className="mt-8 flex flex-col items-center gap-3"
            >
              {isLoggedIn ? (
                isVerified ? (
                  <Button type="submit" size="lg" variant="secondary">
                    Activer mon compte formateur
                  </Button>
                ) : (
                  <Button asChild size="lg" variant="secondary">
                    <Link href="/verifier-email">Vérifier mon email</Link>
                  </Button>
                )
              ) : (
                <Button asChild size="lg" variant="secondary">
                  <Link href="/inscription?callbackUrl=/devenir-formateur">
                    Créer un compte gratuit
                  </Link>
                </Button>
              )}
              <p className="text-xs text-primary-foreground/70">
                Votre accès formateur est encadré par le gestionnaire de la plateforme.
              </p>
            </form>
          </Container>
        </section>

        <section className="py-16">
          <Container className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<PercentCircle className="h-6 w-6" aria-hidden />}
              title="Parcours pédagogiques structurés"
              description="Organisez les contenus, leçons, ressources et évaluations de chaque formation."
            />
            <FeatureCard
              icon={<Users className="h-6 w-6" aria-hidden />}
              title="Audience francophone engagée"
              description="Une communauté d'apprenants et d'apprenantes en France, en Belgique, au Canada et au-delà."
            />
            <FeatureCard
              icon={<PlayCircle className="h-6 w-6" aria-hidden />}
              title="Hébergement vidéo professionnel"
              description="Streaming Mux : haute qualité, sous-titres, lecture adaptative."
            />
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" aria-hidden />}
              title="Tableau de bord complet"
              description="Suivez les apprenants, leur progression et leurs avis en temps réel."
            />
          </Container>
        </section>

        <section className="border-y border-border bg-muted/30 py-16">
          <Container className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                Comment ça marche
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Quatre étapes simples pour publier votre premier cours.
              </p>
            </div>
            <ol className="space-y-4 text-sm">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="flex gap-4 rounded-lg border border-border bg-card p-4"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-primary)] text-xs font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{step.title}</p>
                    <p className="mt-1 text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Container>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[color:var(--brand-primary)]/10 text-[color:var(--brand-primary)]">
          {icon}
        </span>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{description}</CardContent>
    </Card>
  );
}

const STEPS = [
  {
    title: "Activez votre compte formateur",
    description:
      "Le gestionnaire valide votre rôle et vous ouvre l'accès à l'espace formateur.",
  },
  {
    title: "Créez votre cours",
    description:
      "Renseignez le titre, la catégorie et structurez votre programme en sections et leçons.",
  },
  {
    title: "Téléversez vos vidéos",
    description:
      "Upload direct vers Mux, encodage automatique, lecture adaptative sur tous les appareils.",
  },
  {
    title: "Soumettez à la modération",
    description:
      "Notre équipe valide votre cours et il devient achetable par toute la communauté.",
  },
] as const;

const CHECKS_FALLBACK = CheckCircle2; // évite un lint d'import inutilisé si on adapte plus tard
void CHECKS_FALLBACK;
