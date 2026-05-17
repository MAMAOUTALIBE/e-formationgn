// Queries serveur du catalogue.
// Toutes les méthodes filtrent automatiquement par status = PUBLISHED, sauf
// indication contraire (admin / dashboard formateur, géré en Phase 7 / 3).

import { unstable_cache } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { cached } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { prismaRead } from "@/lib/prisma-read";
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

  // Multi-select : level peut être une string (legacy) ou un array.
  if (filters.level) {
    if (Array.isArray(filters.level)) {
      if (filters.level.length === 1) {
        where.level = filters.level[0];
      } else if (filters.level.length > 1) {
        where.level = { in: filters.level };
      }
    } else {
      where.level = filters.level;
    }
  }

  if (filters.rating && filters.rating > 0) {
    where.averageRating = { gte: filters.rating };
  }

  if (filters.price === "free") {
    where.priceEUR = { equals: 0 };
  } else if (filters.price === "paid") {
    where.priceEUR = { gt: 0 };
  }

  // Multi-select : duration peut être un array de buckets (short/medium/long).
  // Chaque bucket = un range → on combine via OR.
  if (filters.duration) {
    const durs = Array.isArray(filters.duration)
      ? filters.duration
      : [filters.duration];
    const conditions: Prisma.CourseWhereInput[] = [];
    for (const d of durs) {
      if (d === "short") conditions.push({ durationSeconds: { lt: 3 * 3600 } });
      else if (d === "medium")
        conditions.push({ durationSeconds: { gte: 3 * 3600, lte: 10 * 3600 } });
      else if (d === "long")
        conditions.push({ durationSeconds: { gt: 10 * 3600 } });
    }
    if (conditions.length === 1) {
      Object.assign(where, conditions[0]);
    } else if (conditions.length > 1) {
      where.OR = conditions;
    }
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
  // Une seule requête SQL qui :
  //   - applique tous les filtres (catégorie, level, prix, durée, rating)
  //   - rank via ts_rank_cd
  //   - ordonne (par rang en mode "relevance", ou par le sort demandé)
  //   - pagine (LIMIT/OFFSET)
  // Évite l'instabilité de pagination de l'ancienne implémentation qui
  // hydratait via Prisma avec `id: in: [...]` (ordre non garanti) puis
  // re-triait en JS après que take/skip avait été appliqué.
  if (term.length > 0) {
    const sqlFilters = buildFullTextFilterSql(filters);
    const tsQuery = Prisma.sql`plainto_tsquery('french', ${term})`;
    const sqlOrder = buildFullTextOrderSql(sort, tsQuery);

    // 1 — IDs paginés + ordre stable côté DB
    const idRows = await prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT c."id" AS id
        FROM "Course" c
        ${sqlFilters.join}
        WHERE c."status" = 'PUBLISHED'
          AND c."searchVector" @@ ${tsQuery}
          ${sqlFilters.where}
        ORDER BY ${sqlOrder}
        LIMIT ${take} OFFSET ${skip}
      `,
    );

    // 2 — COUNT total (mêmes prédicats, sans LIMIT)
    const countRows = await prisma.$queryRaw<Array<{ total: bigint }>>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM "Course" c
        ${sqlFilters.join}
        WHERE c."status" = 'PUBLISHED'
          AND c."searchVector" @@ ${tsQuery}
          ${sqlFilters.where}
      `,
    );
    const total = Number(countRows[0]?.total ?? 0);
    if (idRows.length === 0) {
      return { items: [], total, page, pageCount: Math.max(1, Math.ceil(total / take)), perPage: take };
    }

    // 3 — Hydrate via Prisma. `findMany` ne garantit pas l'ordre du `in`,
    // donc on réordonne côté JS en s'appuyant sur la séquence d'IDs SQL.
    const ids = idRows.map((r) => r.id);
    const hydrated = await prisma.course.findMany({
      where: { id: { in: ids } },
      include: PUBLIC_COURSE_INCLUDE,
    });
    const byId = new Map(hydrated.map((c) => [c.id, c]));
    const ordered = ids
      .map((id) => byId.get(id))
      .filter((c): c is (typeof hydrated)[number] => Boolean(c));

    return {
      items: ordered as PublicCourseListItem[],
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

// ---------------------------------------------------------------------------
// SQL builders pour la branche recherche full-text.
// Tous les littéraux non-utilisateur sont concaténés via Prisma.sql ; les
// valeurs utilisateurs (slug, level, ratings, …) sont passées en paramètres
// pour éviter toute injection.
// ---------------------------------------------------------------------------

function buildFullTextFilterSql(filters: Partial<CourseFilters>): {
  join: Prisma.Sql;
  where: Prisma.Sql;
} {
  const whereParts: Prisma.Sql[] = [];
  let join: Prisma.Sql = Prisma.empty;

  if (filters.category) {
    join = Prisma.sql`INNER JOIN "Category" cat ON cat."id" = c."categoryId"`;
    whereParts.push(Prisma.sql`cat."slug" = ${filters.category}`);
  }

  if (filters.level) {
    // CourseLevel enum — multi-select supporté (array). text cast pour
    // que la comparaison fonctionne quel que soit le type enum côté Postgres.
    const levels = Array.isArray(filters.level) ? filters.level : [filters.level];
    if (levels.length === 1) {
      whereParts.push(Prisma.sql`c."level"::text = ${levels[0]}`);
    } else if (levels.length > 1) {
      whereParts.push(Prisma.sql`c."level"::text IN (${Prisma.join(levels)})`);
    }
  }

  if (filters.rating && filters.rating > 0) {
    whereParts.push(Prisma.sql`c."averageRating" >= ${filters.rating}`);
  }

  if (filters.price === "free") {
    whereParts.push(Prisma.sql`c."priceEUR" = 0`);
  } else if (filters.price === "paid") {
    whereParts.push(Prisma.sql`c."priceEUR" > 0`);
  }

  // Multi-select : duration → OR de range conditions.
  if (filters.duration) {
    const durs = Array.isArray(filters.duration)
      ? filters.duration
      : [filters.duration];
    const durParts: Prisma.Sql[] = [];
    for (const d of durs) {
      if (d === "short") durParts.push(Prisma.sql`c."durationSeconds" < ${3 * 3600}`);
      else if (d === "medium")
        durParts.push(
          Prisma.sql`(c."durationSeconds" >= ${3 * 3600} AND c."durationSeconds" <= ${10 * 3600})`,
        );
      else if (d === "long")
        durParts.push(Prisma.sql`c."durationSeconds" > ${10 * 3600}`);
    }
    if (durParts.length === 1) {
      whereParts.push(durParts[0]);
    } else if (durParts.length > 1) {
      whereParts.push(Prisma.sql`(${Prisma.join(durParts, " OR ")})`);
    }
  }

  // Concatène les conditions en `AND ... AND ...` (préfixe AND pour pouvoir
  // s'enchaîner après le WHERE déjà ouvert par la requête appelante).
  const where = whereParts.length === 0
    ? Prisma.empty
    : Prisma.sql`AND ${Prisma.join(whereParts, " AND ")}`;

  return { join, where };
}

function buildFullTextOrderSql(sort: CourseSort, tsQuery: Prisma.Sql): Prisma.Sql {
  // Tie-breaker `c."id" ASC` partout : garantit un ordre **stable**, sinon
  // deux cours avec le même score peuvent permuter entre les pages
  // (boîte de bug classique avec LIMIT/OFFSET sur Postgres).
  switch (sort) {
    case "popular":
      return Prisma.sql`c."totalEnrollments" DESC, c."averageRating" DESC, c."id" ASC`;
    case "rating":
      return Prisma.sql`c."averageRating" DESC, c."totalRatings" DESC, c."id" ASC`;
    case "newest":
      return Prisma.sql`c."publishedAt" DESC NULLS LAST, c."createdAt" DESC, c."id" ASC`;
    case "price_asc":
      return Prisma.sql`c."priceEUR" ASC, c."id" ASC`;
    case "price_desc":
      return Prisma.sql`c."priceEUR" DESC, c."id" ASC`;
    case "relevance":
    default:
      return Prisma.sql`ts_rank_cd(c."searchVector", ${tsQuery}) DESC, c."totalEnrollments" DESC, c."id" ASC`;
  }
}

export const listFeaturedCourses = unstable_cache(
  async (limit = 6): Promise<PublicCourseListItem[]> => {
    const items = await prisma.course.findMany({
      where: { status: "PUBLISHED" },
      include: PUBLIC_COURSE_INCLUDE,
      orderBy: [{ totalEnrollments: "desc" }, { averageRating: "desc" }],
      take: limit,
    });
    return items as PublicCourseListItem[];
  },
  ["featured-courses"],
  { revalidate: 600, tags: ["courses"] },
);

export const listLatestCourses = unstable_cache(
  async (limit = 6): Promise<PublicCourseListItem[]> => {
    const items = await prisma.course.findMany({
      where: { status: "PUBLISHED" },
      include: PUBLIC_COURSE_INCLUDE,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
    return items as PublicCourseListItem[];
  },
  ["latest-courses"],
  { revalidate: 600, tags: ["courses"] },
);

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

// Batch version : top N PUBLISHED courses per category slug, en 2 requêtes
// (ROW_NUMBER() pour borner par catégorie, puis hydrate Prisma) plutôt qu'une
// findMany par catégorie. Utilisé par la home pour les onglets "populaires".
// Cache : sérialise un Record (Map ne survit pas à la sérialisation).
export const listCoursesByCategorySlugs = unstable_cache(
  async (
    slugs: string[],
    perCategory = 8,
  ): Promise<Record<string, PublicCourseListItem[]>> => {
    const empty: Record<string, PublicCourseListItem[]> = {};
    for (const s of slugs) empty[s] = [];
    if (slugs.length === 0) return empty;

    const rows = await prisma.$queryRaw<Array<{ id: string; slug: string }>>`
      SELECT id, slug
      FROM (
        SELECT c."id" AS id,
               cat."slug" AS slug,
               ROW_NUMBER() OVER (
                 PARTITION BY c."categoryId"
                 ORDER BY c."totalEnrollments" DESC, c."averageRating" DESC
               ) AS rn
        FROM "Course" c
        INNER JOIN "Category" cat ON cat."id" = c."categoryId"
        WHERE c."status" = 'PUBLISHED'
          AND cat."slug" = ANY(${slugs}::text[])
      ) ranked
      WHERE rn <= ${perCategory}
    `;
    if (rows.length === 0) return empty;

    const ids = rows.map((r) => r.id);
    const courses = await prisma.course.findMany({
      where: { id: { in: ids } },
      include: PUBLIC_COURSE_INCLUDE,
      orderBy: [{ totalEnrollments: "desc" }, { averageRating: "desc" }],
    });

    const byId = new Map(courses.map((c) => [c.id, c as PublicCourseListItem]));
    const result = empty;
    for (const row of rows) {
      const course = byId.get(row.id);
      if (!course) continue;
      result[row.slug].push(course);
    }
    return result;
  },
  ["courses-by-category-slugs"],
  { revalidate: 600, tags: ["courses"] },
);

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

// Cross-sell pour le panier — recommande des cours dans les mêmes catégories
// que ceux déjà dans le panier, en excluant ceux du panier + déjà achetés par
// l'utilisateur. Fallback : top des cours populaires si pas de catégorie en
// commun ou pas assez de candidats.
//
// Pattern Amazon/Udemy "Vous pourriez aimer aussi" — gros lever de conversion
// car le user est en mode achat.
export async function listCartCrossSell({
  userId,
  excludeCourseIds,
  fromCategoryIds,
  limit = 4,
}: {
  userId: string;
  excludeCourseIds: string[];
  fromCategoryIds: string[];
  limit?: number;
}): Promise<PublicCourseListItem[]> {
  // 1. Exclut aussi les cours déjà inscrits (Enrollment).
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    select: { courseId: true },
  });
  const excludedIds = new Set([
    ...excludeCourseIds,
    ...enrollments.map((e) => e.courseId),
  ]);

  // 2. D'abord, même catégorie + populaire.
  const sameCategory =
    fromCategoryIds.length > 0
      ? await prisma.course.findMany({
          where: {
            status: "PUBLISHED",
            categoryId: { in: fromCategoryIds },
            id: { notIn: Array.from(excludedIds) },
          },
          include: PUBLIC_COURSE_INCLUDE,
          orderBy: [{ totalEnrollments: "desc" }, { averageRating: "desc" }],
          take: limit,
        })
      : [];

  if (sameCategory.length >= limit) {
    return sameCategory as PublicCourseListItem[];
  }

  // 3. Fallback : top cours toutes catégories pour compléter.
  const fallback = await prisma.course.findMany({
    where: {
      status: "PUBLISHED",
      id: {
        notIn: Array.from(
          new Set([...excludedIds, ...sameCategory.map((c) => c.id)]),
        ),
      },
    },
    include: PUBLIC_COURSE_INCLUDE,
    orderBy: [{ totalEnrollments: "desc" }, { averageRating: "desc" }],
    take: limit - sameCategory.length,
  });

  return [...sameCategory, ...fallback] as PublicCourseListItem[];
}

export async function getPublishedCourseBySlug(
  slug: string,
): Promise<PublicCourseDetail | null> {
  // Read replica : la page /cours/[slug] est l'endpoint le plus lourd du
  // catalogue (include profond). Décharger le primary protège le checkout.
  const course = await prismaRead.course.findUnique({
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

/**
 * Sélectionne UN avis à mettre en avant sur la page cours détail.
 * Priorité aux avis 4-5★ avec commentaire non-null. Pas de champ
 * `isFeatured` côté Review pour rester minimal — la sélection est
 * algorithmique. Renvoie null si aucun avis ne convient.
 */
export async function getFeaturedReview(courseId: string) {
  return prisma.review.findFirst({
    where: {
      courseId,
      isPublished: true,
      rating: { gte: 4 },
      comment: { not: null },
    },
    orderBy: [
      { rating: "desc" }, // 5★ avant 4★
      { createdAt: "desc" }, // puis le plus récent
    ],
    include: {
      user: {
        select: { id: true, name: true, firstName: true, lastName: true, image: true },
      },
    },
  });
}

/**
 * Distribution des notes par étoiles pour un cours.
 * Renvoie un tableau de 5 entrées [5★, 4★, 3★, 2★, 1★] avec count + percent.
 * Utilisé pour l'histogramme façon Udemy dans la section avis.
 */
export interface RatingDistributionBucket {
  rating: 1 | 2 | 3 | 4 | 5;
  count: number;
  percent: number; // 0..100, arrondi à l'entier
}

export async function getCourseRatingDistribution(
  courseId: string,
): Promise<RatingDistributionBucket[]> {
  return cached(
    { key: `course:${courseId}:rating-dist`, ttlSeconds: 300 },
    async () => {
      const grouped = await prisma.review.groupBy({
        by: ["rating"],
        where: { courseId, isPublished: true },
        _count: { _all: true },
      });
      const countByRating = new Map(
        grouped.map((g) => [g.rating, g._count._all]),
      );
      const total = Array.from(countByRating.values()).reduce(
        (sum, n) => sum + n,
        0,
      );

      return ([5, 4, 3, 2, 1] as const).map((rating) => {
        const count = countByRating.get(rating) ?? 0;
        return {
          rating,
          count,
          percent: total === 0 ? 0 : Math.round((count / total) * 100),
        };
      });
    },
  );
}

// Counts par option pour chaque facette du catalogue — pattern Udemy.
// Pour chaque facette, on EXCLUT son propre filtre actif pour répondre à la
// question "si j'ajoute cette option, combien de cours j'aurai ?". C'est ce
// qui rend les filtres pertinents (un user voit immédiatement les options
// qui ramènent des résultats vs celles qui en ont 0).
//
// 5 count queries en parallèle. Coût acceptable pour une page catalogue.
export interface CourseFilterCounts {
  categories: Record<string, number>; // slug → count
  levels: Record<string, number>;
  prices: Record<string, number>; // "free" | "paid"
  durations: Record<string, number>; // "short" | "medium" | "long"
  ratings: Record<string, number>; // "4.5" | "4" | "3.5" | "3"
}

export async function getCourseFilterCounts(
  filters: Partial<CourseFilters> = {},
): Promise<CourseFilterCounts> {
  // Helper : whereInput excluant une facette donnée (pour le compte de cette facette)
  const baseWhere = (excludeKey: keyof CourseFilters): Prisma.CourseWhereInput => {
    const f = { ...filters };
    delete (f as Record<string, unknown>)[excludeKey];
    return buildWhere(f);
  };

  const [categoryGroups, levelGroups, freeCount, paidCount, durationCounts, ratingCounts] =
    await Promise.all([
      // Catégories : group by categoryId
      prisma.course.groupBy({
        by: ["categoryId"],
        where: baseWhere("category"),
        _count: { _all: true },
      }),
      // Niveaux : group by level
      prisma.course.groupBy({
        by: ["level"],
        where: baseWhere("level"),
        _count: { _all: true },
      }),
      // Prix : free vs paid (2 counts)
      prisma.course.count({
        where: { ...baseWhere("price"), priceEUR: { equals: 0 } },
      }),
      prisma.course.count({
        where: { ...baseWhere("price"), priceEUR: { gt: 0 } },
      }),
      // Durée : short / medium / long (3 counts en parallèle)
      Promise.all([
        prisma.course.count({
          where: { ...baseWhere("duration"), durationSeconds: { lt: 3 * 3600 } },
        }),
        prisma.course.count({
          where: {
            ...baseWhere("duration"),
            durationSeconds: { gte: 3 * 3600, lte: 10 * 3600 },
          },
        }),
        prisma.course.count({
          where: { ...baseWhere("duration"), durationSeconds: { gt: 10 * 3600 } },
        }),
      ]),
      // Rating : ≥4.5, ≥4, ≥3.5, ≥3 (4 counts)
      Promise.all([
        prisma.course.count({
          where: { ...baseWhere("rating"), averageRating: { gte: 4.5 } },
        }),
        prisma.course.count({
          where: { ...baseWhere("rating"), averageRating: { gte: 4 } },
        }),
        prisma.course.count({
          where: { ...baseWhere("rating"), averageRating: { gte: 3.5 } },
        }),
        prisma.course.count({
          where: { ...baseWhere("rating"), averageRating: { gte: 3 } },
        }),
      ]),
    ]);

  // Hydrate catégories : on a categoryId → count, mais l'UI veut slug → count.
  const categoryIdToCount: Record<string, number> = {};
  for (const g of categoryGroups) categoryIdToCount[g.categoryId] = g._count._all;
  const categoriesMeta = await prisma.category.findMany({
    where: { id: { in: Object.keys(categoryIdToCount) } },
    select: { id: true, slug: true },
  });
  const categories: Record<string, number> = {};
  for (const cat of categoriesMeta) {
    categories[cat.slug] = categoryIdToCount[cat.id] ?? 0;
  }

  const levels: Record<string, number> = {};
  for (const g of levelGroups) levels[g.level] = g._count._all;

  const [shortCount, mediumCount, longCount] = durationCounts;
  const [r45, r40, r35, r30] = ratingCounts;

  return {
    categories,
    levels,
    prices: { free: freeCount, paid: paidCount },
    durations: { short: shortCount, medium: mediumCount, long: longCount },
    ratings: { "4.5": r45, "4": r40, "3.5": r35, "3": r30 },
  };
}

export async function countPublishedCoursesByCategory(): Promise<Record<string, number>> {
  return cached(
    { key: "categories:counts", ttlSeconds: 600 },
    async () => {
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
    },
  );
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

  // Recherche rankée. Le tie-breaker `id ASC` garantit que la pagination
  // reste stable même quand plusieurs cours partagent le même rang/popularité.
  const hits = await prisma.$queryRaw<CourseSearchHit[]>`
    SELECT id,
           ts_rank_cd("searchVector", plainto_tsquery('french', ${trimmed})) AS rank
    FROM "Course"
    WHERE "status" = 'PUBLISHED'
      AND "searchVector" @@ plainto_tsquery('french', ${trimmed})
    ORDER BY rank DESC, "totalEnrollments" DESC, "id" ASC
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
