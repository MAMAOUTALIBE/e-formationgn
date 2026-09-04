"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-xl border border-border p-6">
      <h1 className="text-lg font-semibold text-foreground">
        L&apos;écran Aiduca-IA n&apos;a pas pu se charger
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Réessayez. Si le problème persiste, vérifiez la connexion à la base de
        données.
      </p>
      <Button onClick={reset} className="mt-4">
        Réessayer
      </Button>
    </div>
  );
}
