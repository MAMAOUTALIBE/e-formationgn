"use client";

import { Flag } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { reportReview } from "@/server/actions/reviews";

/**
 * Bouton « Signaler » un avis abusif → trace un signalement pour la modération.
 * Demande un motif court via prompt natif (suffisant pour un cas rare).
 */
export function ReportReviewButton({ reviewId }: { reviewId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      className="h-auto px-2 text-xs text-muted-foreground"
      onClick={() => {
        const reason = window.prompt(
          "Pourquoi signaler cet avis ? (spam, propos injurieux, hors-sujet…)",
        );
        if (reason === null) return; // annulé
        startTransition(async () => {
          const res = await reportReview(reviewId, reason);
          if (res.success) {
            toast.success(res.message ?? "Avis signalé.");
          } else {
            toast.error(res.message ?? "Échec du signalement.");
          }
        });
      }}
    >
      <Flag className="h-3.5 w-3.5" />
      Signaler
    </Button>
  );
}
