"use client";

import { Compass, SearchX } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

interface CategorySuggestion {
  slug: string;
  name: string;
}

interface CourseEmptyStateProps {
  /** Si fourni, le bouton "Effacer les filtres" pointera vers ce chemin de base. Défaut: /cours */
  basePath?: string;
  /** Mots à conserver en URL après reset (ex: 'category' sur /categories/[slug]). */
  preserveParams?: readonly string[];
  /** Catégories à suggérer quand aucun résultat — affichées en chips cliquables. */
  suggestedCategories?: CategorySuggestion[];
}

export function CourseEmptyState({
  basePath = "/cours",
  preserveParams = ["q"],
  suggestedCategories = [],
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
    <div className="space-y-6">
      <EmptyState
        icon={<SearchX className="h-6 w-6" aria-hidden />}
        title="Aucun cours trouvé"
        description={
          hasFilters
            ? "Aucun cours ne correspond à vos filtres. Essayez d'élargir votre sélection ou explorez une autre catégorie."
            : "Aucun cours n'est encore disponible. Revenez bientôt !"
        }
        action={
          hasFilters ? (
            <Button asChild variant="default">
              <Link href={cleanHref}>Effacer tous les filtres</Link>
            </Button>
          ) : undefined
        }
      />

      {suggestedCategories.length > 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-5 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-foreground">
            <Compass className="h-4 w-4 text-[color:var(--brand-secondary)]" aria-hidden />
            Explorez ces catégories populaires
          </p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {suggestedCategories.map((cat) => (
              <li key={cat.slug}>
                <Link
                  href={`/categories/${cat.slug}`}
                  className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:border-[color:var(--brand-secondary)] hover:bg-[color:var(--brand-secondary)]/5"
                >
                  {cat.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
