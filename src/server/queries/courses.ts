// Queries serveur du catalogue.
// Toutes les méthodes filtrent automatiquement par status = PUBLISHED, sauf
// indication contraire (admin / dashboard formateur, géré en Phase 7 / 3).

import { unstable_cache } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
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
    // CourseLevel enum — Prisma stocke en text natif (CAST côté Postgres si besoin).
    whereParts.push(Prisma.sql`c."level"::text = ${filters.level}`);
  }

  if (filters.rating && filters.rating > 0) {
    whereParts.push(Prisma.sql`c."averageRating" >= ${filters.rating}`);
  }

  if (filters.price === "free") {
    whereParts.push(Prisma.sql`c."priceEUR" = 0`);
  } else if (filters.price === "paid") {
    whereParts.push(Prisma.sql`c."priceEUR" > 0`);
  }

  if (filters.duration === "short") {
    whereParts.push(Prisma.sql`c."durationSeconds" < ${3 * 3600}`);
  } else if (filters.duration === "medium") {
    whereParts.push(
      Prisma.sql`c."durationSeconds" >= ${3 * 3600} AND c."durationSeconds" <= ${10 * 3600}`,
    );
  } else if (filters.duration === "long") {
    whereParts.push(Prisma.sql`c."durationSeconds" > ${10 * 3600}`);
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
