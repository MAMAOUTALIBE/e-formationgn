export const HEARTBEAT_INTERVAL_SECONDS = 20;
export const HEARTBEAT_MAX_DELTA_SECONDS = 45;

export function computeHeartbeatCredit(previous: Date, now: Date): number {
  const elapsed = Math.floor((now.getTime() - previous.getTime()) / 1000);
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
  return Math.min(elapsed, HEARTBEAT_MAX_DELTA_SECONDS);
}

export type HeartbeatActivityMode = "VIDEO" | "INTERACTIVE_CONTENT";

export function shouldSendLearningHeartbeat(input: {
  mode: HeartbeatActivityMode;
  isVisible: boolean;
  isPlaying?: boolean;
  lastActivityAt: number;
  now: number;
  recentActivityMs: number;
}): boolean {
  if (!input.isVisible) return false;
  if (input.mode === "VIDEO") return input.isPlaying === true;
  return input.now - input.lastActivityAt <= input.recentActivityMs;
}

export type PedagogicalStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "AT_RISK"
  | "INACTIVE"
  | "COMPLETED";

export function derivePedagogicalStatus(input: {
  progressPercent: number;
  lastAccessedAt: Date | null;
  failedQuizCount: number;
  now?: Date;
}): PedagogicalStatus {
  if (input.progressPercent >= 100) return "COMPLETED";
  if (input.progressPercent <= 0 && !input.lastAccessedAt) return "NOT_STARTED";
  const now = input.now ?? new Date();
  if (input.lastAccessedAt && now.getTime() - input.lastAccessedAt.getTime() > 14 * 86_400_000) {
    return "INACTIVE";
  }
  if (input.failedQuizCount > 0) return "AT_RISK";
  return "IN_PROGRESS";
}

export const PEDAGOGICAL_STATUS_LABELS: Record<PedagogicalStatus, string> = {
  NOT_STARTED: "Pas commencé",
  IN_PROGRESS: "En cours",
  AT_RISK: "En difficulté",
  INACTIVE: "Inactif",
  COMPLETED: "Terminé",
};
