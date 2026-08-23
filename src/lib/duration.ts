/**
 * Met en forme une durée pour un document destiné à un tiers.
 *
 * Vit dans `lib/` et non dans la requête d'émargement : c'est une fonction
 * pure, et la garder dans un module `server-only` la rendait intestable et
 * inutilisable côté client.
 *
 * Les minutes sont sur deux chiffres — « 4 h 05 » et non « 4 h 5 » — parce que
 * ces valeurs s'alignent en colonnes sur une feuille d'émargement.
 */
export function formatDuree(secondes: number): string {
  if (secondes <= 0) return "—";
  const heures = Math.floor(secondes / 3600);
  const minutes = Math.round((secondes % 3600) / 60);
  if (heures === 0) return `${minutes} min`;
  return minutes === 0 ? `${heures} h` : `${heures} h ${String(minutes).padStart(2, "0")}`;
}
