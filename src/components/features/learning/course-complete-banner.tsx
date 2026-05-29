"use client";

// Bannière affichée dans le lecteur quand l'apprenant a terminé 100 % du
// cours. Propose de générer / récupérer le certificat via l'action
// `issueCertificate`, puis redirige vers la page publique du certificat.

import { Award, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { issueCertificate } from "@/server/actions/certificates";

export function CourseCompleteBanner({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleGetCertificate() {
    setPending(true);
    try {
      const result = await issueCertificate(courseId);
      if (!result.success || !result.serialNumber) {
        toast.error(result.message ?? "Impossible de générer le certificat.");
        return;
      }
      router.push(`/certificat/${result.serialNumber}`);
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-[color:var(--brand-success)]/40 bg-[color:var(--brand-success)]/5">
      <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-success)]/15 text-[color:var(--brand-success)]">
            <Award className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Félicitations, vous avez terminé ce cours&nbsp;! 🎉
            </p>
            <p className="text-xs text-muted-foreground">
              Récupérez votre certificat de réussite, partageable et vérifiable.
            </p>
          </div>
        </div>
        <Button onClick={handleGetCertificate} disabled={pending} className="shrink-0">
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Génération…
            </>
          ) : (
            <>
              <Award className="h-4 w-4" aria-hidden />
              Obtenir mon certificat
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
