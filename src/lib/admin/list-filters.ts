// Lecture des filtres des listes d'administration.
//
// Un filtre arrive de l'URL : c'est une chaîne quelconque, que l'utilisateur
// peut modifier à la main et qu'un signet peut avoir figée dans un état qui
// n'existe plus. Trois comportements coexistaient dans le CRM face à une
// valeur inconnue — planter sur l'énumération Prisma, l'ignorer en silence,
// ou la valider. Ce module impose le troisième partout.
//
// Le choix retenu pour une valeur non reconnue est de l'IGNORER, jamais de
// laisser passer la requête : un filtre incompréhensible ne doit pas décider
// à la place de l'opérateur, et une page d'annuaire ne doit pas répondre 500
// parce qu'une lettre manque dans l'URL.

/**
 * Restreint un paramètre d'URL aux valeurs admises.
 *
 * Renvoie `undefined` — donc « pas de filtre » — pour une valeur absente,
 * vide ou inconnue. La comparaison est stricte : « actif » n'est pas
 * « ACTIVE », et laisser passer l'approximation reviendrait à inventer une
 * intention que l'opérateur n'a pas exprimée.
 */
export function parseListFilter<T extends string>(
  value: string | undefined | null,
  allowed: readonly T[],
): T | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return (allowed as readonly string[]).includes(trimmed)
    ? (trimmed as T)
    : undefined;
}

/**
 * Assemble des groupes de conditions qui doivent TOUS être satisfaits, chacun
 * pouvant être satisfait par n'importe laquelle de ses variantes.
 *
 * Pourquoi ce détour : un `where.OR` unique où l'on empile la recherche
 * textuelle ET un second critère élargit la sélection au lieu de la
 * restreindre. Chercher « Camara » chez les comptes inactifs ramenait alors
 * tous les Camara plus tous les inactifs. Chaque critère a besoin de son
 * propre OR, et les critères entre eux se combinent en ET.
 */
export function allOf<W>(groups: (W[] | undefined)[]): { AND: W[] } | undefined {
  const clauses = groups
    .filter((group): group is W[] => Array.isArray(group) && group.length > 0)
    .map((group) => (group.length === 1 ? group[0] : ({ OR: group } as unknown as W)));

  return clauses.length > 0 ? { AND: clauses } : undefined;
}
