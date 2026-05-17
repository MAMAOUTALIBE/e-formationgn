"use client";

// Bouton "Acheter maintenant" — pattern Udemy. Différent du "Ajouter au panier" :
// route directement vers /panier après l'ajout (un clic au lieu de deux).
// Idéal pour les users qui ne veulent qu'un cours, sans browse.
//
// Côté serveur, `buyCourseNow` add-then-redirect. Si l'user est déjà inscrit
// ou que le rate limit kick, la page panier affiche le message d'erreur via
// `?msg=`.

import { Zap } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { buyCourseNow } from "@/server/actions/cart";

interface BuyNowButtonProps {
  courseId: string;
  className?: string;
  fullWidth?: boolean;
  /** L'élève est-il déjà inscrit ? — masque le bouton (déjà inutile). */
  alreadyEnrolled?: boolean;
}

export function BuyNowButton({
  courseId,
  className,
  fullWidth = true,
  alreadyEnrolled,
}: BuyNowButtonProps) {
  const [pending, startTransition] = useTransition();

  if (alreadyEnrolled) return null;

  function handleClick() {
    startTransition(async () => {
      // Ne pas await ici : buyCourseNow appelle `redirect()` qui throw NEXT_REDIRECT
      // et Next route automatiquement.
      await buyCourseNow(courseId);
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={handleClick}
      disabled={pending}
      className={`${fullWidth ? "w-full" : ""} border-[color:var(--brand-secondary)] text-[color:var(--brand-secondary)] hover:bg-[color:var(--brand-secondary)]/10 ${className ?? ""}`}
    >
      <Zap className="h-4 w-4" aria-hidden />
      {pending ? "Redirection…" : "Acheter maintenant"}
    </Button>
  );
}
