import "server-only";

// Récupération des connaissances d'Aiduca-IA.
//
// Tout ce que le modèle verra passe par ici, et rien d'autre. C'est le point
// de cloisonnement : ces requêtes ne sélectionnent jamais `internalNotes`, ni
// les colonnes de prix, ni la moindre donnée apprenant. Une fuite de données
// internes vers l'assistant serait une fuite publique.
//
// NOTE PRIX — la plateforme tourne en mode `centre_formation` : aucun prix
// n'est affiché sur le site et il n'existe pas de tunnel d'achat. Exposer
// `priceEUR` au modèle l'amènerait à annoncer un tarif que personne ne peut
// payer. Les colonnes de prix sont donc volontairement absentes.

import { COURSE_LEVEL_LABELS } from "@/lib/format/labels";
import { formatDuree } from "@/lib/duration";
import { prisma } from "@/lib/prisma";
import type {
  RetrievedCourse,
  RetrievedDocument,
  RetrievedSession,
} from "@/lib/assistant/contract";

/** Nombre de fiches formation injectées dans le contexte. */
const COURSE_LIMIT = 4;
/** Nombre de fragments documentaires injectés dans le contexte. */
const DOCUMENT_LIMIT = 6;
/** Sessions à venir listées comme « calendrier ». */
const SESSION_LIMIT = 5;

/** Coupe les textes longs : le contexte doit rester lisible et bon marché. */
const MAX_DESCRIPTION_CHARS = 900;

// SÉMANTIQUE DE RECHERCHE — pourquoi pas `plainto_tsquery`
//
// `plainto_tsquery` combine les termes en ET. Pour la barre de recherche du
// catalogue c'est le bon choix : on veut les cours qui parlent de TOUT ce qui
// est tapé. Pour une question en langue naturelle, c'est fatal — « comment
// s'inscrire » exigeait que le mot « comment » figure dans le fragment, et ne
// remontait donc rien.
//
// On construit à la place un OU des lexèmes, classé par `ts_rank_cd` : les
// fragments qui couvrent le plus de termes remontent d'eux-mêmes en tête.
// Rater un fragment coûte une réponse fausse ; en fournir un de trop ne coûte
// rien, le modèle a pour consigne de ne répondre que sur ce qui l'appuie.
//
// Injection : le texte de l'utilisateur passe par `to_tsvector`, qui écarte
// les opérateurs (&, |, !, parenthèses) avant `to_tsquery`, et chaque lexème
// est passé par `quote_literal`. Le paramètre reste lié, jamais concaténé.
//
// `to_tsquery('simple', …)` et non `'french'` : les lexèmes sortent déjà
// stemmés de `to_tsvector('french', …)`. Les repasser au stemmer français les
// stemme une SECONDE fois — « zorglubification » devient `zorglubif` à
// l'indexation mais `zorglub` à la requête, et ne se retrouve jamais. La
// configuration `simple` ne fait que normaliser la casse, ce qui est
// exactement ce qu'il reste à faire ici.

// ---------------------------------------------------------------------------
// Formations
// ---------------------------------------------------------------------------

/**
 * Formations publiées correspondant à la question, via l'index plein-texte
 * français déjà en place sur `Course.searchVector`
 * (prisma/migrations/1_course_search). Même mécanique que `suggestCourses`.
 */
export async function retrieveCourses(
  query: string,
  limit = COURSE_LIMIT,
): Promise<RetrievedCourse[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const hits = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH lex AS (
      SELECT to_tsquery('simple', string_agg(quote_literal(l), ' | ')) AS query
      FROM unnest(tsvector_to_array(to_tsvector('french', ${trimmed}))) AS l
    )
    SELECT c.id
    FROM "Course" c, lex
    WHERE lex.query IS NOT NULL
      AND c."status" = 'PUBLISHED'
      AND c."searchVector" @@ lex.query
    ORDER BY
      ts_rank_cd(c."searchVector", lex.query) DESC,
      c."totalEnrollments" DESC
    LIMIT ${limit}
  `;
  if (hits.length === 0) return [];

  const ids = hits.map((h) => h.id);
  const courses = await prisma.course.findMany({
    where: { id: { in: ids }, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      description: true,
      level: true,
      durationSeconds: true,
      requirements: true,
      whatYouWillLearn: true,
      targetAudience: true,
      category: { select: { name: true } },
      sections: { select: { _count: { select: { lessons: true } } } },
    },
  });

  // `findMany` ne conserve pas l'ordre de pertinence du `IN` : on le rétablit.
  const byId = new Map(courses.map((c) => [c.id, c]));
  return ids
    .map((id) => byId.get(id))
    .filter((c): c is (typeof courses)[number] => Boolean(c))
    .map(toRetrievedCourse);
}

/** Fiche d'une formation précise, pour ancrer une question sur une page cours. */
export async function retrieveCourseBySlug(
  slug: string,
): Promise<RetrievedCourse | null> {
  const course = await prisma.course.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      description: true,
      level: true,
      durationSeconds: true,
      requirements: true,
      whatYouWillLearn: true,
      targetAudience: true,
      category: { select: { name: true } },
      sections: { select: { _count: { select: { lessons: true } } } },
    },
  });
  return course ? toRetrievedCourse(course) : null;
}

type CourseRow = {
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  level: keyof typeof COURSE_LEVEL_LABELS;
  durationSeconds: number;
  requirements: string[];
  whatYouWillLearn: string[];
  targetAudience: string[];
  category: { name: string } | null;
  sections: Array<{ _count: { lessons: number } }>;
};

function toRetrievedCourse(course: CourseRow): RetrievedCourse {
  return {
    sourceId: `formation:${course.slug}`,
    slug: course.slug,
    title: course.title,
    subtitle: course.subtitle,
    categoryName: course.category?.name ?? null,
    levelLabel: COURSE_LEVEL_LABELS[course.level],
    durationLabel:
      course.durationSeconds > 0 ? formatDuree(course.durationSeconds) : null,
    sectionCount: course.sections.length,
    lessonCount: course.sections.reduce((sum, s) => sum + s._count.lessons, 0),
    requirements: course.requirements,
    objectives: course.whatYouWillLearn,
    audience: course.targetAudience,
    description: course.description.slice(0, MAX_DESCRIPTION_CHARS),
    url: `/cours/${course.slug}`,
  };
}

// ---------------------------------------------------------------------------
// Base documentaire
// ---------------------------------------------------------------------------

/** Fragments publiés correspondant à la question (FTS française + GIN). */
export async function retrieveDocuments(
  query: string,
  limit = DOCUMENT_LIMIT,
): Promise<RetrievedDocument[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  return prisma.$queryRaw<RetrievedDocument[]>`
    WITH lex AS (
      SELECT to_tsquery('simple', string_agg(quote_literal(l), ' | ')) AS query
      FROM unnest(tsvector_to_array(to_tsvector('french', ${trimmed}))) AS l
    )
    SELECT
      'doc:' || d."slug" || '#' || c."position" AS "sourceId",
      d."slug"        AS "documentSlug",
      d."title"       AS "title",
      c."heading"     AS "heading",
      c."content"     AS "content",
      d."sourceLabel" AS "sourceLabel",
      d."sourceUrl"   AS "sourceUrl"
    FROM "AssistantChunk" c
    JOIN "AssistantDocument" d ON d."id" = c."documentId", lex
    WHERE d."isPublished" = true
      AND lex.query IS NOT NULL
      AND c."searchVector" @@ lex.query
    ORDER BY
      ts_rank_cd(c."searchVector", lex.query) DESC,
      c."position" ASC
    LIMIT ${limit}
  `;
}

/**
 * Fragments d'une catégorie donnée, sans requête — utilisé pour toujours
 * fournir les essentiels (inscription, contact, financement) même quand la
 * recherche plein-texte ne remonte rien.
 */
export async function retrieveDocumentsByCategory(
  category: string,
  limit = 5,
): Promise<RetrievedDocument[]> {
  // DISTINCT ON : un fragment par document, et non les N premiers fragments du
  // premier document. Sans ça, le filet ne ramenait que le début du document
  // « inscription » et laissait de côté financement, coordonnées et
  // attestations — précisément les sujets qu'il est censé couvrir.
  return prisma.$queryRaw<RetrievedDocument[]>`
    SELECT * FROM (
      SELECT DISTINCT ON (d."id")
        'doc:' || d."slug" || '#' || c."position" AS "sourceId",
        d."slug"        AS "documentSlug",
        d."title"       AS "title",
        c."heading"     AS "heading",
        c."content"     AS "content",
        d."sourceLabel" AS "sourceLabel",
        d."sourceUrl"   AS "sourceUrl",
        d."position"    AS "docPosition"
      FROM "AssistantChunk" c
      JOIN "AssistantDocument" d ON d."id" = c."documentId"
      WHERE d."isPublished" = true
        AND d."category" = ${category}
      ORDER BY d."id", c."position" ASC
    ) essentials
    ORDER BY "docPosition" ASC
    LIMIT ${limit}
  `;
}

// ---------------------------------------------------------------------------
// Calendrier
// ---------------------------------------------------------------------------

/**
 * Sessions planifiées des programmes actifs.
 *
 * On expose le titre, les dates et le lieu — et pour les places, un booléen
 * calculé ici plutôt que l'effectif réel : combien d'inscrits compte une
 * session est une donnée d'exploitation, pas une information publique.
 */
export async function retrieveUpcomingSessions(
  limit = SESSION_LIMIT,
): Promise<RetrievedSession[]> {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      status: "PLANNED",
      startDate: { gte: new Date() },
      program: { status: "ACTIVE" },
    },
    orderBy: { startDate: "asc" },
    take: limit,
    select: {
      id: true,
      startDate: true,
      endDate: true,
      location: true,
      capacity: true,
      program: { select: { title: true } },
      _count: { select: { registrations: true } },
    },
  });

  return sessions.map((s) => ({
    sourceId: `session:${s.id}`,
    programTitle: s.program.title,
    startDate: s.startDate.toISOString().slice(0, 10),
    endDate: s.endDate.toISOString().slice(0, 10),
    location: s.location,
    hasSeatsAvailable:
      s.capacity === null ? null : s._count.registrations < s.capacity,
  }));
}
