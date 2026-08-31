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

/**
 * Une séance encore `SCHEDULED` est-elle dans sa fenêtre d'ouverture anticipée ?
 *
 * C'est ce qui donne enfin un effet au réglage « Ouverture anticipée » : il
 * était stocké et affiché dans le formulaire, mais aucun chemin d'exécution ne
 * le lisait — l'unique appelant de `virtualClassCanBeOpened` force la
 * dérogation, et le contrôle d'entrée ne regardait que le statut. Un apprenant
 * devait donc attendre un clic du formateur, quoi qu'annonce le libellé.
 */
export function withinEarlyJoinWindow(input: {
  startsAt: Date;
  earlyJoinMinutes: number;
  now: Date;
}): boolean {
  const opensAt = input.startsAt.getTime() - input.earlyJoinMinutes * 60_000;
  return input.now.getTime() >= opensAt;
}

export function virtualClassJoinError(input: {
  status: VirtualClassStatusValue;
  scheduledEndAt: Date;
  startsAt?: Date;
  earlyJoinMinutes?: number;
  now?: Date;
}): string | null {
  const now = input.now ?? new Date();
  if (input.status === "CANCELLED") return "Cette séance a été annulée.";
  if (input.status === "ENDED" || now >= input.scheduledEndAt) {
    return "Cette séance est terminée.";
  }
  if (input.status === "OPEN" || input.status === "LIVE") return null;
  if (
    input.status === "SCHEDULED" &&
    input.startsAt &&
    typeof input.earlyJoinMinutes === "number" &&
    withinEarlyJoinWindow({ startsAt: input.startsAt, earlyJoinMinutes: input.earlyJoinMinutes, now })
  ) {
    return null;
  }
  return "La salle n’est pas encore ouverte.";
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

/**
 * Durée de conservation d'un replay, à compter de sa publication.
 *
 * Un enregistrement de classe contient l'image et la voix de personnes
 * identifiées : le garder sans terme n'est pas défendable pour un organisme de
 * formation. La colonne `expiresAt` existait depuis la création du modèle mais
 * n'était ni renseignée ni lue — la rétention était donc annoncée par le
 * schéma et infinie en pratique.
 */
export const VIRTUAL_CLASS_REPLAY_RETENTION_DAYS = 90;

/** Échéance de conservation à poser au moment de la publication. */
export function virtualClassReplayExpiry(publishedAt: Date): Date {
  return new Date(
    publishedAt.getTime() + VIRTUAL_CLASS_REPLAY_RETENTION_DAYS * 24 * 60 * 60_000,
  );
}

/** Un replay non expiré ? `null` signifie « aucune échéance posée ». */
export function isReplayWithinRetention(
  expiresAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  return !expiresAt || expiresAt.getTime() > now.getTime();
}

/**
 * Un apprenant peut-il relire ce message après la fin de la séance ?
 *
 * `visibleAfterClass` était lui aussi déclaré sans jamais être lu : toute la
 * discussion restait lisible indéfiniment, y compris les échanges qui n'ont de
 * sens que pendant le direct.
 */
export function isMessageVisibleToLearner(
  message: { visibleAfterClass: boolean },
  classStatus: VirtualClassStatusValue,
): boolean {
  return classStatus !== "ENDED" || message.visibleAfterClass;
}

/**
 * Résumé d'un `User-Agent`, pour le diagnostic d'assistance.
 *
 * `VirtualClassAttendance.deviceInfo` était déclarée sans être jamais écrite :
 * quand un apprenant signale « je n'avais ni son ni image », le support n'avait
 * aucune trace de son environnement. On garde un résumé, pas la chaîne brute :
 * elle est longue, très identifiante, et sa version détaillée n'apporte rien au
 * diagnostic.
 */
export function summarizeUserAgent(userAgent: string | null | undefined): {
  browser: string;
  os: string;
  mobile: boolean;
} {
  const ua = (userAgent ?? "").slice(0, 400);
  // L'ordre compte : Edge et Opera annoncent aussi « Chrome », et Chrome
  // annonce « Safari ». On teste donc du plus spécifique au plus générique.
  const browser =
    /\bEdge?\//i.test(ua) ? "Edge"
    : /\b(OPR|Opera)\//i.test(ua) ? "Opera"
    : /\bFirefox\//i.test(ua) ? "Firefox"
    : /\bChrome\//i.test(ua) ? "Chrome"
    : /\bSafari\//i.test(ua) ? "Safari"
    : "Inconnu";
  const os =
    /\bAndroid\b/i.test(ua) ? "Android"
    : /\b(iPhone|iPad|iPod)\b/i.test(ua) ? "iOS"
    : /\bWindows\b/i.test(ua) ? "Windows"
    : /\bMac OS X\b/i.test(ua) ? "macOS"
    : /\bLinux\b/i.test(ua) ? "Linux"
    : "Inconnu";
  // `iPad` d'abord : les iPad récents se déclarent « Macintosh » et ne portent
  // pas « Mobile ».
  const mobile = /\b(iPhone|iPad|iPod|Android|Mobile)\b/i.test(ua);
  return { browser, os, mobile };
}
