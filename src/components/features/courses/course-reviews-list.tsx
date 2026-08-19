"use client";

// Liste des avis avec recherche, filtre par étoiles, tri — pattern Udemy.
// Filtrage/tri client-side sur les reviews déjà chargées (le serveur charge
// les N plus récents). Pour les cours avec >100 avis, ajouter un "Charger
// plus" qui re-fetch côté serveur ; à ce stade le client-only suffit.

import { Search, X } from "lucide-react";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Stars } from "@/components/ui/stars";
import { cn } from "@/lib/utils";

interface ReviewItem {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: Date | string;
  user: {
    id: string;
    name: string | null;
    firstName: string | null;
    image: string | null;
  };
}

interface CourseReviewsListProps {
  reviews: ReviewItem[];
  averageRating: number;
  totalRatings: number;
}

type SortOption = "recent" | "oldest" | "highest" | "lowest";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const STAR_FILTERS = [5, 4, 3, 2, 1] as const;

export function CourseReviewsList({
  reviews,
  averageRating,
  totalRatings,
}: CourseReviewsListProps) {
  const [query, setQuery] = React.useState("");
  const [starFilter, setStarFilter] = React.useState<number | null>(null);
  const [sort, setSort] = React.useState<SortOption>("recent");

  const filtered = React.useMemo(() => {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
    const q = normalize(query.trim());

    let result = reviews.filter((r) => {
      if (starFilter !== null && r.rating !== starFilter) return false;
      if (q.length === 0) return true;
      const hay = `${r.title ?? ""} ${r.comment ?? ""} ${r.user.name ?? ""}`;
      return normalize(hay).includes(q);
    });

    const dateOf = (d: Date | string) =>
      typeof d === "string" ? new Date(d).getTime() : d.getTime();

    result = [...result].sort((a, b) => {
      switch (sort) {
        case "recent":
          return dateOf(b.createdAt) - dateOf(a.createdAt);
        case "oldest":
          return dateOf(a.createdAt) - dateOf(b.createdAt);
        case "highest":
          return b.rating - a.rating || dateOf(b.createdAt) - dateOf(a.createdAt);
        case "lowest":
          return a.rating - b.rating || dateOf(b.createdAt) - dateOf(a.createdAt);
      }
    });

    return result;
  }, [reviews, query, starFilter, sort]);

  if (totalRatings === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
        Cette formation n&apos;a pas encore reçu d&apos;avis. Soyez le premier à la noter une fois inscrit.
      </div>
    );
  }

  const hasFilter = starFilter !== null || query.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl font-semibold text-foreground">
          {averageRating.toFixed(1)}
        </span>
        <div>
          <Stars rating={averageRating} size="md" />
          <p className="text-xs text-muted-foreground">
            {totalRatings.toLocaleString("fr-FR")} avis au total
          </p>
        </div>
      </div>

      {/* Barre de filtres */}
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">
              Rechercher dans les avis
            </span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Mots-clés, formateur, contenu…"
                className="pl-9"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-foreground">
              Trier par
            </span>
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="h-10 w-auto"
            >
              <option value="recent">Plus récents</option>
              <option value="oldest">Plus anciens</option>
              <option value="highest">Note la plus haute</option>
              <option value="lowest">Note la plus basse</option>
            </Select>
          </label>
        </div>

        {/* Filtres par étoiles — pills cliquables */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-foreground">
            Filtrer :
          </span>
          <StarPill
            label="Tous"
            active={starFilter === null}
            onClick={() => setStarFilter(null)}
          />
          {STAR_FILTERS.map((n) => (
            <StarPill
              key={n}
              label={`${n}★`}
              active={starFilter === n}
              onClick={() => setStarFilter(starFilter === n ? null : n)}
            />
          ))}
          {hasFilter ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStarFilter(null);
              }}
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden />
              Effacer
            </button>
          ) : null}
        </div>

        {hasFilter ? (
          <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
            <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
            sur {reviews.length} avis affichés
          </p>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
          Aucun avis ne correspond à votre recherche.
        </div>
      ) : (
        <ul className="space-y-4">
          {filtered.map((review) => {
            const name = review.user.name ?? review.user.firstName ?? "Élève";
            const initials = name[0]?.toUpperCase() ?? "?";
            const createdAt =
              typeof review.createdAt === "string"
                ? new Date(review.createdAt)
                : review.createdAt;
            return (
              <li
                key={review.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <Avatar src={review.user.image} alt={name} fallback={initials} size={36} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateFormatter.format(createdAt)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Stars rating={review.rating} size="sm" />
                  {review.title ? (
                    <p className="text-sm font-medium text-foreground">{review.title}</p>
                  ) : null}
                </div>
                {review.comment ? (
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    {review.comment}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StarPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-[color:var(--brand-secondary)] bg-[color:var(--brand-secondary)] text-white"
          : "border-border bg-card text-foreground hover:border-[color:var(--brand-secondary)]/40 hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
