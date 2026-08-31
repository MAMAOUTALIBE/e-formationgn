import { safeTimeZone, utcToZonedDateTimeLocal } from "@/lib/time-zone";

export function virtualClassPersonName(person: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  return (
    person.name?.trim() ||
    [person.firstName, person.lastName].filter(Boolean).join(" ").trim() ||
    person.email ||
    "Utilisateur"
  );
}

export function formatVirtualClassDate(value: Date | string, timezone = "Europe/Paris") {
  // `safeTimeZone` et non la valeur brute : les séances créées avant la
  // validation stricte peuvent porter un fuseau que `Intl` refuse, et ces
  // formateurs sont appelés depuis des listes. On dégrade l'affichage d'une
  // ligne plutôt que de renvoyer une 500 sur toute la page.
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: safeTimeZone(timezone),
  }).format(new Date(value));
}

export function formatVirtualClassShortDate(value: Date | string, timezone = "Europe/Paris") {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: safeTimeZone(timezone),
  }).format(new Date(value));
}

/**
 * Valeur d'un `<input type="datetime-local">` pour une séance.
 *
 * Exprimée dans le fuseau de la séance, pas dans celui du serveur qui rend la
 * page : sans ça, le formulaire de modification réaffichait une heure décalée
 * et la réenregistrer déplaçait la séance.
 */
export function dateTimeLocalValue(value: Date | string, timezone = "Europe/Paris") {
  return utcToZonedDateTimeLocal(value, timezone);
}

export function formatDurationSeconds(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours} h ${String(minutes).padStart(2, "0")} min` : `${minutes} min`;
}
