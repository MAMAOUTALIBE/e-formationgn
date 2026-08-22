// Nom complet d'une personne, saisi en un seul champ.
//
// Deux champs séparés « Prénom » et « Nom » supposent un ordre — celui du
// français administratif. Les personnes inscrites au centre ne le partagent
// pas toutes, et un formulaire qui impose la découpe fait saisir de travers
// plutôt qu'il ne structure. On saisit donc l'identité telle qu'elle se lit
// et s'imprime sur une attestation, dans `User.name`.
//
// `firstName` et `lastName` restent alimentés, mais en dérivés : ils ne
// servent plus qu'au tri alphabétique des listes, à la recherche et aux
// initiales de l'avatar. Tout ce qui s'AFFICHE lit `name`, qui contient
// exactement la chaîne saisie — un découpage approximatif n'a donc jamais de
// conséquence visible.

export interface SplitName {
  /** Chaîne saisie, espaces normalisés. Fait foi pour tout affichage. */
  name: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Découpe un nom complet en dérivés de tri.
 *
 * Coupure au PREMIER espace : c'est l'inverse exact de la construction
 * historique `name = \`${firstName} ${lastName}\``, donc les données déjà en
 * base font l'aller-retour sans se déformer. « Mamadou Alpha Barry » donne
 * ainsi prénom « Mamadou » et nom « Alpha Barry ».
 *
 * Un nom d'un seul mot part dans `lastName` : c'est lui qui porte le tri des
 * listes, et un mononyme se classe avec les noms de famille.
 */
export function splitFullName(input: string): SplitName {
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length === 0) return { name: "", firstName: null, lastName: null };

  const separator = name.indexOf(" ");
  if (separator === -1) return { name, firstName: null, lastName: name };

  return {
    name,
    firstName: name.slice(0, separator),
    lastName: name.slice(separator + 1),
  };
}

/**
 * Nom complet d'un compte existant, pour pré-remplir le champ de saisie.
 * `name` d'abord : c'est la valeur saisie. Les deux colonnes dérivées ne
 * servent de repli que pour les comptes antérieurs au champ unique.
 */
export function joinFullName(user: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const stored = user.name?.trim();
  if (stored) return stored;
  return [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}
