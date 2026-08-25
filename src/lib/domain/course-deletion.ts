export const COURSE_NOT_DELETABLE_MESSAGE =
  "Cette formation possède des commandes, inscriptions, certificats ou appartient à un programme. Pour préserver cet historique, elle ne peut pas être supprimée définitivement. Archivez-la à la place.";

export interface CourseDeletionMedia { ownerId: string; muxAssetIds: string[]; storedUrls: string[] }
export type CourseDeletionOutcome =
  | { kind: "deleted"; title: string; media: CourseDeletionMedia }
  | { kind: "blocked" }
  | { kind: "missing" }
  | { kind: "concurrent" };

export interface CourseDeletionDependencies {
  authorize: () => Promise<{ userId: string }>;
  deleteRecord: () => Promise<CourseDeletionOutcome>;
  cleanup: (media: CourseDeletionMedia) => Promise<void>;
  audit: (actorId: string, title: string) => Promise<void>;
  onDeleted: () => void;
}

export async function executeCourseDeletion(deps: CourseDeletionDependencies) {
  let actor: { userId: string };
  try { actor = await deps.authorize(); }
  catch { return { success: false, message: "Accès refusé." }; }

  const outcome = await deps.deleteRecord();
  if (outcome.kind === "blocked") return { success: false, message: COURSE_NOT_DELETABLE_MESSAGE };
  if (outcome.kind === "missing") return { success: false, message: "Formation introuvable." };
  if (outcome.kind === "concurrent") return { success: false, message: "Modification concurrente détectée. Réessayez." };

  await deps.cleanup(outcome.media);
  await deps.audit(actor.userId, outcome.title);
  deps.onDeleted();
  return { success: true, message: "Formation supprimée définitivement." };
}
