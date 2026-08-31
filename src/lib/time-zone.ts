/**
 * Conversion entre une heure « murale » (celle que saisit un humain) et
 * l'instant UTC stocké en base.
 *
 * Un champ `<input type="datetime-local">` renvoie une chaîne SANS décalage
 * (« 2026-09-01T10:00 »). `new Date()` l'interprète alors dans le fuseau du
 * PROCESSUS : sur le poste de développement en `Europe/Paris` le résultat est
 * juste, dans le conteneur de production (UTC, aucun `TZ` déclaré dans
 * docker-compose) il est décalé de l'offset du fuseau réel. La séance
 * s'affichait donc à 12:00 alors que l'administrateur avait saisi 10:00.
 *
 * Ces fonctions rendent la conversion explicite : le fuseau déclaré sur la
 * ressource fait autorité, jamais celui du serveur.
 */

const OFFSET_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/** Formateur mémoïsé : `Intl.DateTimeFormat` est coûteux à instancier. */
const partFormatters = new Map<string, Intl.DateTimeFormat>();

function partFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = partFormatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  partFormatters.set(timeZone, formatter);
  return formatter;
}

/** Le fuseau est-il connu du moteur ICU ? Sert de garde avant tout formatage. */
export function isSupportedTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    partFormatter(value.trim()).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Fuseau utilisable, avec repli.
 *
 * Les lignes déjà en base ont pu être écrites avant la validation stricte :
 * un fuseau invalide y ferait lever `Intl` au rendu, et comme les cartes de
 * séance sont listées côté admin, formateur ET apprenant, une seule ligne
 * corrompue renvoyait une 500 sur les trois espaces. On dégrade au lieu de
 * casser.
 */
export function safeTimeZone(value: unknown, fallback = "Europe/Paris"): string {
  if (isSupportedTimeZone(value)) return value.trim();
  return isSupportedTimeZone(fallback) ? fallback : "UTC";
}

/** Décalage du fuseau (en ms) à l'instant donné, DST comprise. */
export function timeZoneOffsetMs(timeZone: string, at: Date): number {
  const parts = partFormatter(timeZone).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );
  // Les millisecondes ne sont pas restituées par `formatToParts` : on les
  // retire des deux côtés pour que la soustraction reste exacte.
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * « 2026-09-01T10:00 » + « Europe/Paris » → l'instant UTC correspondant.
 *
 * Une chaîne qui porte déjà un décalage (`Z`, `+02:00`) est absolue : elle est
 * rendue telle quelle, sans réinterprétation.
 */
export function zonedDateTimeToUtc(localDateTime: string, timeZone: string): Date {
  const trimmed = localDateTime.trim();
  if (OFFSET_SUFFIX.test(trimmed)) return new Date(trimmed);

  const zone = safeTimeZone(timeZone);
  // Première approximation : lire la saisie comme si elle était en UTC.
  const naive = new Date(`${trimmed}${trimmed.length === 16 ? ":00" : ""}Z`);
  if (Number.isNaN(naive.getTime())) return naive;

  const firstGuess = new Date(naive.getTime() - timeZoneOffsetMs(zone, naive));
  // Second passage : autour d'un changement d'heure, l'offset applicable est
  // celui de l'instant résultant, pas celui de l'approximation.
  const refined = new Date(naive.getTime() - timeZoneOffsetMs(zone, firstGuess));
  return refined;
}

/**
 * L'inverse : instant UTC → « YYYY-MM-DDTHH:mm » lisible par un
 * `<input type="datetime-local">`, exprimé dans le fuseau de la ressource.
 */
export function utcToZonedDateTimeLocal(value: Date | string, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const zoned = new Date(date.getTime() + timeZoneOffsetMs(safeTimeZone(timeZone), date));
  return zoned.toISOString().slice(0, 16);
}

/**
 * Fuseaux proposés en premier dans les formulaires — ceux des publics
 * réellement servis par la plateforme. La liste complète reste accessible,
 * ceci n'est qu'un ordre d'affichage.
 */
export const COMMON_TIME_ZONES = [
  "Europe/Paris",
  "Africa/Conakry",
  "Africa/Dakar",
  "Africa/Abidjan",
  "Africa/Bamako",
  "Africa/Casablanca",
  "Africa/Algiers",
  "Africa/Tunis",
  "Africa/Douala",
  "Africa/Kinshasa",
  "Europe/Brussels",
  "Europe/London",
  "America/Montreal",
  "UTC",
] as const;

/** Tous les fuseaux connus du moteur, ou la liste courte si indisponible. */
export function supportedTimeZones(): readonly string[] {
  const withValues = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  try {
    const all = withValues.supportedValuesOf?.("timeZone");
    if (all?.length) return all;
  } catch {
    // ICU réduit : on retombe sur la liste courte.
  }
  return COMMON_TIME_ZONES;
}
