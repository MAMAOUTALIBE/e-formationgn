// Génération de slugs URL-safe à partir d'un titre.
// Garde l'identifiant lisible mais déterministe ; on ajoute un suffixe court
// pour éviter les collisions (le slug seul ne garantit pas l'unicité).

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les diacritiques
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function appendSlugSuffix(slug: string, suffix: string): string {
  const trimmed = slug.length > 0 ? slug : "cours";
  return `${trimmed}-${suffix}`;
}
