/**
 * Visuels IA communs aux catégories et aux cartes de formation.
 *
 * La catégorie est la source de vérité du domaine : son visuel passe avant une
 * ancienne miniature éventuellement renseignée sur la formation. Les domaines
 * non couverts conservent leur miniature personnalisée.
 */
export const COURSE_DOMAIN_BACKGROUNDS: Readonly<Record<string, string>> = {
  developpement: "/images/categories/developpement.webp",
  isolation: "/images/categories/isolation.webp",
  pac: "/images/categories/pac.webp",
  "pompe-a-chaleur": "/images/categories/pac.webp",
  pv: "/images/categories/photovoltaique.webp",
  photovoltaique: "/images/categories/photovoltaique.webp",
  elec: "/images/categories/electricite.webp",
  electricite: "/images/categories/electricite.webp",
  marketing: "/images/categories/marketing.webp",
  "marketing-digital": "/images/categories/marketing.webp",
  "developpement-personnel": "/images/categories/developpement-personnel.webp",
};

export function getCourseDomainBackground(
  categorySlug: string | null | undefined,
): string | null {
  if (!categorySlug) return null;
  return COURSE_DOMAIN_BACKGROUNDS[categorySlug] ?? null;
}

export function resolveCourseCardBackground(
  categorySlug: string | null | undefined,
  thumbnailUrl: string | null | undefined,
): string | null {
  return getCourseDomainBackground(categorySlug) ?? thumbnailUrl ?? null;
}
