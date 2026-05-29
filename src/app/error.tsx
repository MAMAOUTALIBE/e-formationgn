"use client";

// Error boundary de segment (App Router). Remplace le contenu de la page quand
// une erreur runtime est levée pendant le render/handler. Le root layout
// (html/body/ThemeProvider/Toaster) reste monté autour.
//
// NB : error.tsx DOIT être un Client Component → on n'importe pas SiteHeader/
// SiteFooter (Server Components async). On rend une page autonome, brandée,
// avec juste un lien retour vers l'accueil.

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Remonte l'erreur à Sentry (complète le report serveur automatique).
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/20 py-16">
      <Container className="max-w-xl text-center">
        <Link
          href="/"
          className="text-2xl font-bold text-[color:var(--brand-primary)]"
        >
          Gandal
        </Link>
        <p className="mt-8 text-5xl font-bold text-[color:var(--brand-primary)]">
          Oups
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-foreground">
          Une erreur est survenue
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Quelque chose s&apos;est mal passé de notre côté. Vous pouvez
          réessayer&nbsp;; si le problème persiste, revenez un peu plus tard.
        </p>
        {error.digest ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Référence&nbsp;:{" "}
            <code className="rounded bg-muted px-1">{error.digest}</code>
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Réessayer
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Retour à l&apos;accueil</Link>
          </Button>
        </div>
      </Container>
    </main>
  );
}
