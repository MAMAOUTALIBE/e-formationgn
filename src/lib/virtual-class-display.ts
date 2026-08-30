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
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export function formatVirtualClassShortDate(value: Date | string, timezone = "Europe/Paris") {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

export function dateTimeLocalValue(value: Date | string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function formatDurationSeconds(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours} h ${String(minutes).padStart(2, "0")} min` : `${minutes} min`;
}
