// Validation des paramètres URL du catalogue (filtres, recherche, tri).
// Tous les champs sont optionnels — la page lit `searchParams` et n'applique
// que les filtres explicitement présents.

import { z } from "zod";

export const COURSE_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"] as const;
export type CourseLevelFilter = (typeof COURSE_LEVELS)[number];

export const SORT_OPTIONS = [
  "relevance",
  "popular",
  "rating",
  "newest",
  "price_asc",
  "price_desc",
] as const;
export type CourseSort = (typeof SORT_OPTIONS)[number];

export const PRICE_FILTERS = ["all", "free", "paid"] as const;
export type PriceFilter = (typeof PRICE_FILTERS)[number];

export const DURATION_FILTERS = ["all", "short", "medium", "long"] as const;
export type DurationFilter = (typeof DURATION_FILTERS)[number];
// short  = < 3h, medium = 3-10h, long = > 10h

export const COURSES_PER_PAGE = 12;

const stringOrFirst = z
  .preprocess((value) => (Array.isArray(value) ? value[0] : value), z.string())
  .optional();

export const courseFiltersSchema = z.object({
  q: stringOrFirst,
  category: stringOrFirst,
  level: stringOrFirst.transform((value) => {
    if (!value) return undefined;
    return (COURSE_LEVELS as readonly string[]).includes(value)
      ? (value as CourseLevelFilter)
      : undefined;
  }),
  price: stringOrFirst.transform((value) => {
    if (!value) return undefined;
    return (PRICE_FILTERS as readonly string[]).includes(value)
      ? (value as PriceFilter)
      : undefined;
  }),
  rating: stringOrFirst.transform((value) => {
    if (!value) return undefined;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return undefined;
    return Math.min(5, Math.max(0, parsed));
  }),
  duration: stringOrFirst.transform((value) => {
    if (!value) return undefined;
    return (DURATION_FILTERS as readonly string[]).includes(value)
      ? (value as DurationFilter)
      : undefined;
  }),
  sort: stringOrFirst.transform((value) => {
    if (!value) return "relevance" as CourseSort;
    return (SORT_OPTIONS as readonly string[]).includes(value)
      ? (value as CourseSort)
      : ("relevance" as CourseSort);
  }),
  page: stringOrFirst.transform((value) => {
    if (!value) return 1;
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 1) return 1;
    return Math.floor(parsed);
  }),
});

export type CourseFilters = z.output<typeof courseFiltersSchema>;
