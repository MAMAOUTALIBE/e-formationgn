"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UsersError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="flex h-full max-h-[calc(100dvh-12.5rem)] items-center justify-center"><div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-destructive dark:bg-red-500/10"><AlertTriangle className="h-6 w-6" /></span><h1 className="mt-4 text-lg font-semibold">Impossible de charger les apprenants</h1><p className="mt-1 text-sm text-muted-foreground">Une erreur est survenue. Vos critères de recherche sont conservés.</p><Button className="mt-5" onClick={reset}><RotateCcw className="h-4 w-4" />Réessayer</Button></div></div>;
}
