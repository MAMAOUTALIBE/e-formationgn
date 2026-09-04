// Contrat de réponse d'Aiduca-IA — types partagés et re-validation serveur.
//
// Ce module est volontairement PUR : aucune dépendance à Prisma, au SDK
// Groq ni à `server-only`. C'est ce qui permet de tester l'essentiel de
// la garantie d'ancrage sans base de données, sans clé API et sans facturer un
// seul appel au modèle (voir tests/unit/assistant-grounding.test.ts).
//
// Principe : le modèle ne rédige pas la vérité, il la sélectionne. Tout ce
// qu'il renvoie — slugs de formations, liens, niveau de certitude — est
// re-confronté ici au contexte réellement récupéré en base. Ce qui n'y figure
// pas est retiré, pas corrigé.

export type AssistantCertaintyValue = "CERTAINE" | "PARTIELLE" | "INCONNUE";

/** Fiche formation transmise au modèle. Aucun prix : voir NOTE ci-dessous. */
export interface RetrievedCourse {
  /** Identifiant de source cité par le modèle (`formation:<slug>`). */
  sourceId: string;
  slug: string;
  title: string;
  subtitle: string | null;
  categoryName: string | null;
  levelLabel: string;
  durationLabel: string | null;
  lessonCount: number;
  sectionCount: number;
  /** `Course.requirements` — les pré-requis affichés sur la fiche publique. */
  requirements: string[];
  /** `Course.whatYouWillLearn` — les objectifs pédagogiques. */
  objectives: string[];
  /** `Course.targetAudience` — le public visé. */
  audience: string[];
  description: string;
  url: string;
}

/** Fragment de la base documentaire. */
export interface RetrievedDocument {
  /** `doc:<slug>#<position>`. */
  sourceId: string;
  documentSlug: string;
  title: string;
  heading: string | null;
  content: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
}

/** Session de formation planifiée — le « calendrier » du centre. */
export interface RetrievedSession {
  sourceId: string;
  programTitle: string;
  startDate: string;
  endDate: string;
  location: string | null;
  /**
   * Booléen volontaire plutôt qu'un effectif : le nombre de places restantes
   * est une donnée d'exploitation, pas une information publique.
   */
  hasSeatsAvailable: boolean | null;
}

export interface AssistantContext {
  courses: RetrievedCourse[];
  documents: RetrievedDocument[];
  sessions: RetrievedSession[];
}

/** Ce que le modèle renvoie via l'outil `repondre`, avant validation. */
export interface RawAssistantAnswer {
  reponse: string;
  certitude: AssistantCertaintyValue;
  sourcesUtilisees: string[];
  formationsCitees: string[];
  proposerConseiller: boolean;
  questionsSuggerees: string[];
}

/** Bouton « Voir la formation » — construit, jamais dicté par le modèle. */
export interface AssistantCourseAction {
  slug: string;
  title: string;
  url: string;
}

/** Réponse validée, telle qu'affichée et telle que persistée. */
export interface AssistantAnswer {
  text: string;
  certainty: AssistantCertaintyValue;
  /** Faux dès que la certitude n'est pas totale — alimente l'écran admin. */
  answered: boolean;
  offerAdvisor: boolean;
  courses: AssistantCourseAction[];
  suggestions: string[];
  sourceIds: string[];
}

// ---------------------------------------------------------------------------
// Liste blanche de liens
// ---------------------------------------------------------------------------

/**
 * Routes publiques vivantes. Liste BLANCHE et non liste noire : une route
 * neutralisée par src/proxy.ts (`/panier`, `/commande`, `/admin/finances`…)
 * renverrait un 404 à l'utilisateur, et une liste noire oublie toujours la
 * route ajoutée après elle.
 */
const ALLOWED_EXACT_PATHS = new Set([
  "/",
  "/cours",
  "/categories",
  "/aide",
  "/a-propos",
  "/contact",
  "/cgv",
  "/mentions-legales",
  "/confidentialite",
  "/cookies",
  "/credits",
  "/connexion",
  "/apprentissage",
  "/classes-virtuelles",
  "/notifications",
  "/profil",
]);

const ALLOWED_PATH_PREFIXES = [
  "/cours/",
  "/categories/",
  "/certificat/",
  "/formateurs/",
];

/** Schémas de contact autorisés dans le corps d'une réponse. */
const ALLOWED_SCHEMES = ["mailto:", "tel:"];

/**
 * Vrai si le lien peut être proposé à un utilisateur sans risque de page morte.
 * Les URL absolues sont refusées (hors mailto/tel) : l'assistant parle du site
 * d'Aiduca, il n'envoie pas ailleurs.
 */
export function isSafeAssistantLink(href: string): boolean {
  const value = href.trim();
  if (value.length === 0) return false;

  if (ALLOWED_SCHEMES.some((scheme) => value.toLowerCase().startsWith(scheme))) {
    return true;
  }

  if (!value.startsWith("/") || value.startsWith("//")) return false;

  // On compare le chemin seul : une ancre ou une query ne change pas la cible.
  const path = value.split("?")[0].split("#")[0];
  const normalized =
    path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;

  if (ALLOWED_EXACT_PATHS.has(normalized)) return true;
  return ALLOWED_PATH_PREFIXES.some(
    (prefix) => normalized.startsWith(prefix) && normalized.length > prefix.length,
  );
}

/**
 * Retire les liens markdown qui ne passent pas la liste blanche, en gardant
 * leur libellé. Mieux vaut une phrase sans lien qu'un lien vers un 404.
 */
export function stripUnsafeLinks(markdown: string): string {
  return markdown.replace(
    /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (match, label: string, href: string) =>
      isSafeAssistantLink(href) ? match : label,
  );
}

// ---------------------------------------------------------------------------
// Re-validation
// ---------------------------------------------------------------------------

const MAX_SUGGESTIONS = 3;
const MAX_COURSE_ACTIONS = 3;

const FALLBACK_TEXT =
  "Je n'ai pas trouvé cette information dans les données d'Aiduca. " +
  "Un conseiller peut vous répondre précisément.";

/**
 * Confronte la sortie du modèle au contexte réellement récupéré.
 *
 * Trois garanties, dans cet ordre :
 *  1. un slug absent du contexte est supprimé — donc aucun bouton « Voir la
 *     formation » ne peut pointer vers une fiche inexistante ;
 *  2. une certitude autre que `CERTAINE` force la proposition de conseiller et
 *     marque le message comme sans réponse pour l'équipe ;
 *  3. tout lien hors liste blanche est retiré du corps de la réponse.
 */
export function normalizeAssistantAnswer(
  raw: RawAssistantAnswer,
  context: AssistantContext,
): AssistantAnswer {
  const bySlug = new Map(context.courses.map((c) => [c.slug, c]));
  const knownSourceIds = new Set<string>([
    ...context.courses.map((c) => c.sourceId),
    ...context.documents.map((d) => d.sourceId),
    ...context.sessions.map((s) => s.sourceId),
  ]);

  const courses: AssistantCourseAction[] = [];
  const seen = new Set<string>();
  for (const slug of raw.formationsCitees ?? []) {
    const course = bySlug.get(slug);
    if (!course || seen.has(slug)) continue;
    seen.add(slug);
    courses.push({ slug: course.slug, title: course.title, url: course.url });
    if (courses.length === MAX_COURSE_ACTIONS) break;
  }

  const certainty: AssistantCertaintyValue = isCertainty(raw.certitude)
    ? raw.certitude
    : "INCONNUE";
  const answered = certainty === "CERTAINE";

  const text = stripUnsafeLinks((raw.reponse ?? "").trim()) || FALLBACK_TEXT;

  return {
    text,
    certainty,
    answered,
    // Une réponse incertaine DOIT ouvrir la porte vers un humain, quoi que le
    // modèle ait décidé : c'est la promesse faite à l'utilisateur.
    offerAdvisor: Boolean(raw.proposerConseiller) || !answered,
    courses,
    suggestions: (raw.questionsSuggerees ?? [])
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 120)
      .slice(0, MAX_SUGGESTIONS),
    sourceIds: (raw.sourcesUtilisees ?? []).filter((id) => knownSourceIds.has(id)),
  };
}

function isCertainty(value: unknown): value is AssistantCertaintyValue {
  return value === "CERTAINE" || value === "PARTIELLE" || value === "INCONNUE";
}

/** Réponse servie quand aucun appel au modèle n'a pu aboutir. */
export function buildUnavailableAnswer(text: string): AssistantAnswer {
  return {
    text,
    certainty: "INCONNUE",
    answered: false,
    offerAdvisor: true,
    courses: [],
    suggestions: [],
    sourceIds: [],
  };
}
