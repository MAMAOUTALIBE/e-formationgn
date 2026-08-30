export const VIRTUAL_CLASS_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "OPEN",
  "LIVE",
  "ENDED",
  "CANCELLED",
] as const;

export type VirtualClassStatusValue = (typeof VIRTUAL_CLASS_STATUSES)[number];
export type VirtualClassRoomRole = "ADMIN" | "INSTRUCTOR" | "STUDENT";

export function resolveVirtualClassRoomRole(input: {
  userRole: string;
  userId: string;
  instructorId: string;
  hasActiveRegistration: boolean;
}): VirtualClassRoomRole | null {
  if (input.userRole === "ADMIN" || input.userRole === "MANAGER") return "ADMIN";
  if (input.userRole === "INSTRUCTOR" && input.userId === input.instructorId) return "INSTRUCTOR";
  if (input.userRole === "STUDENT" && input.hasActiveRegistration) return "STUDENT";
  return null;
}

export function virtualClassPublishingPolicy(role: VirtualClassRoomRole) {
  const moderator = role === "ADMIN" || role === "INSTRUCTOR";
  return {
    canSubscribe: true,
    canPublish: moderator,
    canPublishData: true,
    sources: moderator ? ["CAMERA", "MICROPHONE", "SCREEN_SHARE", "SCREEN_SHARE_AUDIO"] as const : [] as const,
  };
}

export function totalAttendanceSeconds(periods: Array<{ joinedAt: Date; leftAt: Date | null }>, now: Date) {
  return periods.reduce((total, period) => total + Math.max(0, Math.floor(((period.leftAt ?? now).getTime() - period.joinedAt.getTime()) / 1000)), 0);
}

const TRANSITIONS: Readonly<Record<VirtualClassStatusValue, readonly VirtualClassStatusValue[]>> = {
  DRAFT: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["DRAFT", "OPEN", "CANCELLED"],
  OPEN: ["LIVE", "ENDED", "CANCELLED"],
  LIVE: ["ENDED"],
  ENDED: [],
  CANCELLED: [],
};

export function canTransitionVirtualClass(
  from: VirtualClassStatusValue,
  to: VirtualClassStatusValue,
): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

export function virtualClassTransitionError(
  from: VirtualClassStatusValue,
  to: VirtualClassStatusValue,
): string | null {
  return canTransitionVirtualClass(from, to)
    ? null
    : `Transition de ${from} vers ${to} interdite.`;
}

export function virtualClassCanBeOpened(input: {
  status: VirtualClassStatusValue;
  startsAt: Date;
  scheduledEndAt: Date;
  earlyJoinMinutes: number;
  allowBeforeOpeningWindow?: boolean;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  const opensAt = input.startsAt.getTime() - input.earlyJoinMinutes * 60_000;
  return (
    input.status === "SCHEDULED" &&
    (input.allowBeforeOpeningWindow || now.getTime() >= opensAt) &&
    now.getTime() < input.scheduledEndAt.getTime()
  );
}

export function virtualClassJoinError(input: {
  status: VirtualClassStatusValue;
  scheduledEndAt: Date;
  now?: Date;
}): string | null {
  const now = input.now ?? new Date();
  if (input.status === "CANCELLED") return "Cette séance a été annulée.";
  if (input.status === "ENDED" || now >= input.scheduledEndAt) {
    return "Cette séance est terminée.";
  }
  if (input.status !== "OPEN" && input.status !== "LIVE") {
    return "La salle n’est pas encore ouverte.";
  }
  return null;
}

export function attendanceStatusForDuration(
  attendedSeconds: number,
  scheduledSeconds: number,
): "ABSENT" | "PARTIAL" | "PRESENT" {
  if (attendedSeconds <= 0) return "ABSENT";
  if (scheduledSeconds <= 0) return "PRESENT";
  return attendedSeconds >= Math.round(scheduledSeconds * 0.8)
    ? "PRESENT"
    : "PARTIAL";
}
