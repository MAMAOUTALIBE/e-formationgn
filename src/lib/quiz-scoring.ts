export interface ScoringAnswer {
  optionIds: string[];
  placements?: Array<{ optionId: string; targetId: string }>;
  point?: { x: number; y: number };
}

export interface ScoringQuestion {
  kind: string;
  answerConfig: unknown;
  options: Array<{ id: string; isCorrect: boolean; targetId: string | null }>;
}

export function getDragTargetLabels(config: unknown): Map<string, string> {
  if (!config || typeof config !== "object" || Array.isArray(config) || !("targets" in config)) return new Map();
  const targets = (config as { targets?: unknown }).targets;
  if (!Array.isArray(targets)) return new Map();
  return new Map(targets.flatMap((target) =>
    target && typeof target === "object" && !Array.isArray(target) && "id" in target && "label" in target && typeof target.id === "string" && typeof target.label === "string"
      ? [[target.id, target.label] as const]
      : [],
  ));
}

function hotspotAnswer(config: unknown) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  const { x, y, radius } = config as { x?: unknown; y?: unknown; radius?: unknown };
  return typeof x === "number" && typeof y === "number" && typeof radius === "number" ? { x, y, radius } : null;
}

export function isQuizAnswerCorrect(question: ScoringQuestion, answer: ScoringAnswer | undefined) {
  if (!answer) return false;
  if (question.kind === "DRAG_DROP") {
    const placements = new Map((answer.placements ?? []).map((item) => [item.optionId, item.targetId]));
    return question.options.length > 0 && question.options.every((option) => option.targetId !== null && placements.get(option.id) === option.targetId);
  }
  if (question.kind === "HOTSPOT") {
    const expected = hotspotAnswer(question.answerConfig);
    if (!expected || !answer.point) return false;
    return Math.hypot(answer.point.x - expected.x, answer.point.y - expected.y) <= expected.radius;
  }
  const correct = new Set(question.options.filter((option) => option.isCorrect).map((option) => option.id));
  const submitted = new Set(answer.optionIds);
  return submitted.size === correct.size && Array.from(correct).every((id) => submitted.has(id));
}
