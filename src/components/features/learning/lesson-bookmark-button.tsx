"use client";

import { useOptimistic, useTransition } from "react";
import { Bookmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toggleLessonBookmark } from "@/server/actions/lesson-bookmark";
import { cn } from "@/lib/utils";

interface LessonBookmarkButtonProps {
  lessonId: string;
  initialBookmarked: boolean;
}

export function LessonBookmarkButton({
  lessonId,
  initialBookmarked,
}: LessonBookmarkButtonProps) {
  // useOptimistic permet de basculer l'icône instantanément, le server
  // action confirme ensuite (et corrige si erreur — improbable hors auth lost).
  const [bookmarked, setOptimisticBookmarked] = useOptimistic(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      setOptimisticBookmarked(!bookmarked);
      const result = await toggleLessonBookmark(lessonId);
      // Si le server contredit l'optimistic (rare : seulement perte d'auth),
      // useOptimistic se réaligne au prochain render (revalidatePath dans
      // l'action force la cohérence).
      if (!result.success) {
        setOptimisticBookmarked(bookmarked); // rollback
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={bookmarked}
      aria-label={
        bookmarked
          ? "Retirer la leçon des sauvegardes"
          : "Sauvegarder cette leçon"
      }
      title={bookmarked ? "Sauvegardée" : "Sauvegarder"}
    >
      <Bookmark
        className={cn(
          "h-4 w-4 transition-colors",
          bookmarked && "fill-[color:var(--brand-primary)] text-[color:var(--brand-primary)]",
        )}
        aria-hidden
      />
      <span className="hidden sm:inline">
        {bookmarked ? "Sauvegardée" : "Sauvegarder"}
      </span>
    </Button>
  );
}
