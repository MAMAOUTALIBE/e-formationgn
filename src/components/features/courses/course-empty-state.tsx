"use client";

import { SearchX } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

interface CourseEmptyStateProps {
  /** Si fourni, le bouton "Effacer les filtres" pointera vers ce chemin de base. Défaut: /cours */
  basePath?: string;
  /** Mots à conserver en URL après reset (ex: 'category' sur /categories/[slug]). */
  preserveParams?: readonly string[];
}

export function CourseEmptyState({
  basePath = "/cours",
  preserveParams = ["q"],
}: CourseEmptyStateProps) {
  const params = useSearchParams();

  const hasFilters = ["category", "level", "price", "duration", "rating"].some(
    (key) => params.get(key),
  );

  const cleanQs = new URLSearchParams();
  for (const key of preserveParams) {
    const value = params.get(key);
    if (value) cleanQs.set(key, value);
  }
  const cleanHref = cleanQs.toString() ? `${basePath}?${cleanQs}` : basePath;

  return (
    <EmptyState
      icon={<SearchX className="h-6 w-6" aria-hidden />}
      title="Aucun cours trouvé"
      description={
        hasFilters
          ? "Aucun cours ne correspond à vos filtres. Essayez d'élargir votre sélection."
          : "Aucun cours n'est encore disponible. Revenez bientôt !"
      }
      action={
        hasFilters ? (
          <Button asChild variant="default">
            <Link href={cleanHref}>Effacer les filtres</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
