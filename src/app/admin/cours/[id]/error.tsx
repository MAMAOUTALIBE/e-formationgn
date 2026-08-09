"use client";

import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AdminCourseDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-course-detail flex h-full min-h-[28rem] items-center justify-center">
      <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-destructive dark:bg-red-500/10">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-lg font-semibold">Impossible de charger ce cours</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Une erreur est survenue. Aucune modification n’a été appliquée.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="outline" asChild><Link href="/admin/cours"><ArrowLeft className="h-4 w-4" />Retour</Link></Button>
          <Button onClick={reset}><RotateCcw className="h-4 w-4" />Réessayer</Button>
        </div>
      </div>
    </div>
  );
}
