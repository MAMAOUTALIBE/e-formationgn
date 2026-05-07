// Formatage des durées (secondes) pour affichage en français.

export function formatDurationFromSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return "0 min";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${String(minutes).padStart(2, "0")}`;
}

export function formatLessonDuration(seconds: number): string {
  if (!seconds || seconds < 60) {
    return `${Math.max(0, Math.round(seconds))} s`;
  }
  return formatDurationFromSeconds(seconds);
}
