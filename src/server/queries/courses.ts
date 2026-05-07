// Queries serveur du catalogue.
// Toutes les méthodes filtrent automatiquement par status = PUBLISHED, sauf
// indication contraire (admin / dashboard formateur, géré en Phase 7 / 3).

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  COURSES_PER_PAGE,
  type CourseFilters,
  type CourseSort,
} from "@/lib/validators/courses";

const PUBLIC_COURSE_INCLUDE = {
  instructor: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      headline: true,
      image: true,
    },
  },
  category: {
    select: { id: true, slug: true, name: true },
  },
} satisfies Prisma.CourseInclude;

export type PublicCourseListItem = Prisma.CourseGetPayload<{
  include: typeof PUBLIC_COURSE_INCLUDE;
}>;

interface ListCoursesParams {
  filters?: Partial<CourseFilters>;
  take?: number;
  skip?: number;
}

interface ListCoursesResult {
  items: PublicCourseListItem[];
  total: number;
  page: number;
  pageCount: number;
  perPage: number;
}

function buildOrderBy(sort: CourseSort): Prisma.CourseOrderByWithRelationInput[] {
  switch (sort) {
    case "popular":
      return [{ totalEnrollments: "desc" }, { averageRating: "desc" }];
    case "rating":
      return [{ averageRating: "desc" }, { totalRatings: "desc" }];
    case "newest":
      return [{ publishedAt: "desc" }, { createdAt: "desc" }];
    case "price_asc":
      return [{ priceEUR: "asc" }];
    case "price_desc":
      return [{ priceEUR: "desc" }];
    case "relevance":
    default:
      // Sans algo de pertinence dédié pour l'instant : best effort
      // (note × inscriptions, en faveur de l'engagement).
      return [
        { averageRating: "desc" },
        { totalEnrollments: "desc" },
        { publishedAt: "desc" },
      ];
  }
}

function buildWhere(filters: Partial<CourseFilters> = {}): Prisma.CourseWhereInput {
  const where: Prisma.CourseWhereInput = { status: "PUBLISHED" };

  // Note: le filtre `q` est géré séparément via tsvector dans
  // `listPublishedCourses` — voir plus bas. On l'ignore ici.

  if (filters.category) {
    where.category = { slug: filters.category };
  }

  if (filters.level) {
    where.level = filters.level;
  }

  if (filters.rating && filters.rating > 0) {
    where.averageRating = { gte: filters.rating };
  }

  if (filters.price === "free") {
    where.priceEUR = { equals: 0 };
  } else if (filters.price === "paid") {
    where.priceEUR = { gt: 0 };
  }

  if (filters.duration === "short") {
    where.durationSeconds = { lt: 3 * 3600 };
  } else if (filters.duration === "medium") {
    where.durationSeconds = { gte: 3 * 3600, lte: 10 * 3600 };
  } else if (filters.duration === "long") {
    where.durationSeconds = { gt: 10 * 3600 };
  }

  return where;
}

export async function listPublishedCourses({
  filters = {},
  take = COURSES_PER_PAGE,
  skip = 0,
}: ListCoursesParams = {}): Promise<ListCoursesResult> {
  const where = buildWhere(filters);
  const sort = filters.sort ?? "relevance";
  const page = filters.page ?? 1;
  const term = filters.q?.trim() ?? "";

  // --- Recherche full-text Postgres -------------------------------------
  // Quand `q` est saisi, on récupère d'abord les ids+rang via tsvector,
  // puis on hydrate via Prisma (en intersectant avec les autres filtres).
  if (term.length > 0) {
    const matchRows = await prisma.$queryRaw<Array<{ id: string; rank: number }>>`
      SELECT id,
             ts_rank_cd("searchVector", plainto_tsquery('french', ${term})) AS rank
      FROM "Course"
      WHERE "status" = 'PUBLISHED'
        AND "searchVector" @@ plainto_tsquery('french', ${term})
    `;

    if (matchRows.length === 0) {
      return { items: [], total: 0, page, pageCount: 1, perPage: take };
    }

    const ids = matchRows.map((r) => r.id);
    const rankById = new Map(matchRows.map((r) => [r.id, r.rank]));
    const whereWithIds: Prisma.CourseWhereInput = { ...where, id: { in: ids } };

    const [items, total] = await Promise.all([
      prisma.course.findMany({
        where: whereWithIds,
        include: PUBLIC_COURSE_INCLUDE,
        orderBy: sort === "relevance" ? undefined : buildOrderBy(sort),
        take,
        skip,
      }),
      prisma.course.count({ where: whereWithIds }),
    ]);

    // Pour `sort=relevance`, on réordonne par ts_rank_cd (Prisma ne sait pas).
    if (sort === "relevance") {
      items.sort((a, b) => (rankById.get(b.id) ?? 0) - (rankById.get(a.id) ?? 0));
    }

    return {
      items: items as PublicCourseListItem[],
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / take)),
      perPage: take,
    };
  }

  // --- Listing classique (pas de q) -------------------------------------
  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: PUBLIC_COURSE_INCLUDE,
      orderBy: buildOrderBy(sort),
      take,
      skip,
    }),
    prisma.course.count({ where }),
  ]);

  return {
    items: items as PublicCourseListItem[],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / take)),
    perPage: take,
  };
}

export async function listFeaturedCourses(limit = 6): Promise<PublicCourseListItem[]> {
  const items = await prisma.course.findMany({
    where: { status: "PUBLISHED" },
    include: PUBLIC_COURSE_INCLUDE,
    orderBy: [{ totalEnrollments: "desc" }, { averageRating: "desc" }],
    take: limit,
  });
  return items as PublicCourseListItem[];
}

export async function listLatestCourses(limit = 6): Promise<PublicCourseListItem[]> {
  const items = await prisma.course.findMany({
    where: { status: "PUBLISHED" },
    include: PUBLIC_COURSE_INCLUDE,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return items as PublicCourseListItem[];
}

export async function listCoursesByCategorySlug(
  slug: string,
  limit = 4,
): Promise<PublicCourseListItem[]> {
  const items = await prisma.course.findMany({
    where: { status: "PUBLISHED", category: { slug } },
    include: PUBLIC_COURSE_INCLUDE,
    orderBy: [{ totalEnrollments: "desc" }, { averageRating: "desc" }],
    take: limit,
  });
  return items as PublicCourseListItem[];
}

const COURSE_DETAIL_INCLUDE = {
  instructor: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      headline: true,
      bio: true,
      image: true,
      websiteUrl: true,
      linkedinUrl: true,
    },
  },
  category: { select: { id: true, slug: true, name: true } },
  sections: {
    orderBy: { displayOrder: "asc" },
    include: {
      lessons: {
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          title: true,
          type: true,
          videoDurationSeconds: true,
          isFreePreview: true,
          displayOrder: true,
        },
      },
    },
  },
  reviews: {
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      user: { select: { id: true, name: true, firstName: true, image: true } },
    },
  },
  tags: { select: { id: true, slug: true, name: true } },
} satisfies Prisma.CourseInclude;

export type PublicCourseDetail = Prisma.CourseGetPayload<{
  include: typeof COURSE_DETAIL_INCLUDE;
}>;

export async function getPublishedCourseBySlug(
  slug: string,
): Promise<PublicCourseDetail | null> {
  const course = await prisma.course.findUnique({
    where: { slug },
    include: COURSE_DETAIL_INCLUDE,
  });
  if (!course) return null;
  if (course.status !== "PUBLISHED") return null;
  return course as PublicCourseDetail;
}

export async function getRelatedCourses(
  courseId: string,
  categoryId: string,
  limit = 4,
): Promise<PublicCourseListItem[]> {
  const items = await prisma.course.findMany({
    where: {
      status: "PUBLISHED",
      categoryId,
      NOT: { id: courseId },
    },
    include: PUBLIC_COURSE_INCLUDE,
    orderBy: [{ averageRating: "desc" }, { totalEnrollments: "desc" }],
    take: limit,
  });
  return items as PublicCourseListItem[];
}

export async function countPublishedCoursesByCategory(): Promise<Record<string, number>> {
  const groups = await prisma.course.groupBy({
    by: ["categoryId"],
    where: { status: "PUBLISHED" },
    _count: { _all: true },
  });
  const result: Record<string, number> = {};
  for (const group of groups) {
    result[group.categoryId] = group._count._all;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Recherche full-text Postgres
// ---------------------------------------------------------------------------
//
// Stratégie en deux temps :
//   1. `prisma.$queryRaw` ranke les ids des cours via `ts_rank_cd` (cd = cover
//      density, prend en compte la proximité des termes).
//   2. On recharge les cours via Prisma pour bénéficier des include typés.
//
// La requête utilise `plainto_tsquery` qui parse la saisie utilisateur sans
// nécessiter de syntaxe spéciale (pas de & ou | à apprendre).
// On filtre uniquement les cours PUBLISHED, et la limite garde la latence basse.

interface CourseSearchHit {
  id: string;
  rank: number;
}

export interface SearchCoursesResult {
  items: PublicCourseListItem[];
  total: number;
}

export async function searchCourses(
  query: string,
  options: { take?: number; skip?: number } = {},
): Promise<SearchCoursesResult> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { items: [], total: 0 };

  const take = Math.min(Math.max(options.take ?? 24, 1), 60);
  const skip = Math.max(options.skip ?? 0, 0);

  // Comptage total (séparé pour pagination)
  const totalRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "Course"
    WHERE "status" = 'PUBLISHED'
      AND "searchVector" @@ plainto_tsquery('french', ${trimmed})
  `;
  const total = Number(totalRows[0]?.count ?? 0);
  if (total === 0) return { items: [], total: 0 };

  // Recherche rankée
  const hits = await prisma.$queryRaw<CourseSearchHit[]>`
    SELECT id,
           ts_rank_cd("searchVector", plainto_tsquery('french', ${trimmed})) AS rank
    FROM "Course"
    WHERE "status" = 'PUBLISHED'
      AND "searchVector" @@ plainto_tsquery('french', ${trimmed})
    ORDER BY rank DESC, "totalEnrollments" DESC
    LIMIT ${take} OFFSET ${skip}
  `;
  if (hits.length === 0) return { items: [], total };

  const ids = hits.map((h) => h.id);
  const courses = await prisma.course.findMany({
    where: { id: { in: ids } },
    include: PUBLIC_COURSE_INCLUDE,
  });

  // Préserver l'ordre par rank (Prisma `findMany` ne garantit pas l'ordre des `in`).
  const byId = new Map(courses.map((c) => [c.id, c]));
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((c): c is (typeof courses)[number] => Boolean(c));

  return { items: ordered as PublicCourseListItem[], total };
}

// Suggestions courtes (autocomplete header) — top 5 par rang.
export async function suggestCourses(query: string, limit = 5) {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const hits = await prisma.$queryRaw<
    Array<{ id: string; slug: string; title: string; subtitle: string | null }>
  >`
    SELECT id, slug, title, subtitle
    FROM "Course"
    WHERE "status" = 'PUBLISHED'
      AND "searchVector" @@ plainto_tsquery('french', ${trimmed})
    ORDER BY
      ts_rank_cd("searchVector", plainto_tsquery('french', ${trimmed})) DESC,
      "totalEnrollments" DESC
    LIMIT ${limit}
  `;
  return hits;
}
