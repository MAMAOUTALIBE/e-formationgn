// Calcul des badges marketing à afficher sur la page d'un cours.
// Inspiré d'Udemy : Bestseller (top ventes), Hot & New (récent), Highest Rated.
//
// Règles **simples et déterministes** côté serveur — pas de query supplémentaire,
// tout est calculé depuis les champs déjà chargés du cours (totalEnrollments,
// averageRating, totalRatings, publishedAt, isFeatured).
//
// L'admin peut forcer un cours en vitrine via `isFeatured=true` : on lui
// donne automatiquement le badge « Bestseller ». Pour les autres :
//   - Bestseller   : totalEnrollments ≥ 100
//   - Top noté     : averageRating ≥ 4,5 ET totalRatings ≥ 10
//   - Nouveau      : publishedAt il y a moins de 60 jours
//
// Les seuils sont volontairement bas pour la phase de lancement — à
// remonter quand le catalogue aura grossi.

const BESTSELLER_MIN_ENROLLMENTS = 100;
const TOP_RATED_MIN_AVERAGE = 4.5;
const TOP_RATED_MIN_REVIEWS = 10;
const NEW_DAYS = 60;

export type CourseBadgeKind = "bestseller" | "top-rated" | "new";

export interface CourseBadge {
  kind: CourseBadgeKind;
  label: string;
  /** Variante visuelle — utilisée par le composant <CourseBadges>. */
  variant: "success" | "warning" | "info";
}

interface BadgeSourceCourse {
  totalEnrollments: number;
  averageRating: number;
  totalRatings: number;
  // string accepté : la date peut traverser une boundary Client Component
  // (sérialisation JSON → string ISO) avant d'arriver ici.
  publishedAt: Date | string | null;
  isFeatured: boolean;
}

/**
 * Retourne 0..3 badges à afficher sur le cours, dans l'ordre de priorité.
 * Le badge « Bestseller » prend la première place ; un cours peut être à
 * la fois Bestseller et Top noté (les deux s'affichent).
 */
export function getCourseBadges(course: BadgeSourceCourse): CourseBadge[] {
  const badges: CourseBadge[] = [];

  if (
    course.isFeatured ||
    course.totalEnrollments >= BESTSELLER_MIN_ENROLLMENTS
  ) {
    badges.push({
      kind: "bestseller",
      label: "Bestseller",
      variant: "warning", // accent jaune-orangé type Udemy
    });
  }

  if (
    course.averageRating >= TOP_RATED_MIN_AVERAGE &&
    course.totalRatings >= TOP_RATED_MIN_REVIEWS
  ) {
    badges.push({
      kind: "top-rated",
      label: "Top noté",
      variant: "success",
    });
  }

  if (course.publishedAt) {
    const publishedAtMs =
      typeof course.publishedAt === "string"
        ? new Date(course.publishedAt).getTime()
        : course.publishedAt.getTime();
    const ageDays = (Date.now() - publishedAtMs) / (1000 * 60 * 60 * 24);
    if (ageDays <= NEW_DAYS) {
      badges.push({
        kind: "new",
        label: "Nouveau",
        variant: "info",
      });
    }
  }

  return badges;
}
