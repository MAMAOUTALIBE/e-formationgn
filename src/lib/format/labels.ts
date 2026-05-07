// Libellés métier en français — centralisés pour éviter la duplication
// dans les composants et garantir la cohérence du vocabulaire.

import type { CourseLevel } from "@/generated/prisma/enums";

export const COURSE_LEVEL_LABELS: Record<CourseLevel, string> = {
  BEGINNER: "Débutant",
  INTERMEDIATE: "Intermédiaire",
  ADVANCED: "Avancé",
  ALL_LEVELS: "Tous niveaux",
};

export const SORT_LABELS: Record<string, string> = {
  relevance: "Pertinence",
  popular: "Popularité",
  rating: "Mieux notés",
  newest: "Nouveautés",
  price_asc: "Prix croissant",
  price_desc: "Prix décroissant",
};

export const PRICE_FILTER_LABELS: Record<string, string> = {
  all: "Tous",
  free: "Gratuits",
  paid: "Payants",
};

export const DURATION_FILTER_LABELS: Record<string, string> = {
  all: "Toutes durées",
  short: "Moins de 3 h",
  medium: "3 à 10 h",
  long: "Plus de 10 h",
};

export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1 || count === 0) return singular;
  return plural ?? `${singular}s`;
}
