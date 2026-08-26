export const PROGRAM_NOT_DELETABLE_MESSAGE =
  "Ce programme porte au moins une inscription. Il ne peut pas être supprimé définitivement : les conventions, feuilles d’émargement et attestations qui en découlent doivent rester consultables. Archivez-le à la place. Un programme dont les sessions sont restées vides, lui, reste supprimable.";

export interface DeletedProgram {
  id: string;
  title: string;
  code: string | null;
}
export interface ProgramDeletionResult {
  success: boolean;
  programId?: string;
  message?: string;
}
export interface ProgramDeletionDependencies {
  authorize: () => Promise<{ userId: string }>;
  deleteIfUnused: (programId: string) => Promise<DeletedProgram | "blocked" | null>;
  audit: (input: {
    actorId: string;
    action: "program.delete";
    targetType: "Program";
    targetId: string;
    metadata: { title: string; code: string | null };
  }) => Promise<void>;
  revalidate: (path: string) => void;
}

function databaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

/** Orchestre la suppression sans dépendre de Next/Prisma, afin que chaque issue soit testable. */
export async function executeProgramDeletion(
  dependencies: ProgramDeletionDependencies,
  programId: string,
): Promise<ProgramDeletionResult> {
  let actor: { userId: string };
  try {
    actor = await dependencies.authorize();
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  let deleted: DeletedProgram | "blocked" | null;
  try {
    deleted = await dependencies.deleteIfUnused(programId);
  } catch (error) {
    const code = databaseErrorCode(error);
    if (code === "P2003") return { success: false, programId, message: PROGRAM_NOT_DELETABLE_MESSAGE };
    if (code === "P2034") return { success: false, programId, message: "Modification concurrente détectée. Réessayez." };
    throw error;
  }

  if (deleted === "blocked") return { success: false, programId, message: PROGRAM_NOT_DELETABLE_MESSAGE };
  if (!deleted) return { success: false, programId, message: "Programme de formation introuvable." };

  await dependencies.audit({
    actorId: actor.userId,
    action: "program.delete",
    targetType: "Program",
    targetId: deleted.id,
    metadata: { title: deleted.title, code: deleted.code },
  });
  dependencies.revalidate("/admin/formations");
  dependencies.revalidate(`/admin/formations/${programId}`);
  return { success: true, programId, message: `« ${deleted.title} » a été supprimé définitivement.` };
}
