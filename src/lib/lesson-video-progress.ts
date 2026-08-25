export interface LessonVideoMetrics {
  watchedSeconds: number;
  lastPositionSeconds: number;
}

/** Le cumul est monotone ; la position suit la dernière requête sérialisée. */
export function mergeLessonVideoMetrics(
  existing: LessonVideoMetrics | null,
  incoming: Partial<LessonVideoMetrics>,
): LessonVideoMetrics {
  return {
    watchedSeconds: Math.max(existing?.watchedSeconds ?? 0, incoming.watchedSeconds ?? 0),
    lastPositionSeconds: incoming.lastPositionSeconds ?? existing?.lastPositionSeconds ?? 0,
  };
}
