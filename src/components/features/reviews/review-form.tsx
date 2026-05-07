"use client";

import { Star } from "lucide-react";
import { useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { upsertReview } from "@/server/actions/reviews";

interface ReviewFormProps {
  courseId: string;
  initial?: {
    rating: number;
    title: string;
    comment: string;
  };
}

export function ReviewForm({ courseId, initial }: ReviewFormProps) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setFeedback(null);
    formData.set("courseId", courseId);
    formData.set("rating", String(rating));
    if (rating === 0) {
      setFeedback({ kind: "error", message: "Choisissez une note." });
      return;
    }
    startTransition(async () => {
      const result = await upsertReview(formData);
      setFeedback({
        kind: result.success ? "ok" : "error",
        message:
          result.message ?? (result.success ? "Merci pour votre avis !" : "Erreur."),
      });
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {feedback ? (
        <Alert variant={feedback.kind === "ok" ? "success" : "destructive"}>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Votre note</p>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => {
            const filled = value <= rating;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`${value} étoile${value > 1 ? "s" : ""}`}
                className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Star
                  className={`h-6 w-6 ${
                    filled
                      ? "fill-[color:var(--brand-warning)] text-[color:var(--brand-warning)]"
                      : "text-muted-foreground/40"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <FormField id="title" label="Titre" hint="Optionnel">
        <Input
          id="title"
          name="title"
          maxLength={120}
          defaultValue={initial?.title ?? ""}
        />
      </FormField>

      <FormField id="comment" label="Votre avis" hint="Partagez votre expérience.">
        <Textarea
          id="comment"
          name="comment"
          rows={4}
          maxLength={2000}
          defaultValue={initial?.comment ?? ""}
        />
      </FormField>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi…" : initial ? "Mettre à jour mon avis" : "Publier mon avis"}
        </Button>
      </div>
    </form>
  );
}
