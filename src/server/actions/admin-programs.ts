"use server";

// Server Actions des formations (programmes) et de leurs sessions.
//
// Une suppression physique est réservée aux programmes qui n'ont jamais eu de
// session. Dès qu'une session existe (même annulée), l'archivage préserve
// l'historique des inscriptions et des attestations.

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { requireAnyAdminRole } from "@/lib/auth/authorization";
import { adminRolesForScreen } from "@/lib/workspace/admin-screen-roles";
import {
  ACTIVE_PROGRAM_REQUIRES_COURSE,
  canActivateProgram,
} from "@/lib/domain/training-integrity";
import { executeProgramDeletion } from "@/lib/domain/program-deletion";
import { prisma } from "@/lib/prisma";
import { programSchema, sessionSchema } from "@/lib/validators/program";
import { createAuditLog } from "@/server/services/audit-log";

export interface ProgramActionResult {
  success: boolean;
  message?: string;
  programId?: string;
  fieldErrors?: Record<string, string>;
  /**
   * Valeurs reçues, renvoyées en cas d'échec.
   *
   * React 19 réinitialise le formulaire dès que l'action a répondu : sans ce
   * renvoi, la saisie repart à vide au premier champ mal rempli. Le formulaire
   * s'en sert comme `defaultValue`, ce qui la restaure.
   */
  values?: Record<string, string>;
}

function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function readProgramForm(formData: FormData) {
  const get = (k: string) => (formData.get(k) as string | null) ?? "";
  return {
    title: get("title"),
    code: get("code"),
    description: get("description"),
    durationHours: get("durationHours"),
    status: get("status") || "DRAFT",
  };
}

export async function createProgram(
  _prev: ProgramActionResult,
  formData: FormData,
): Promise<ProgramActionResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole(...adminRolesForScreen("/admin/formations"));
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  const raw = readProgramForm(formData);
  const parsed = programSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Corrigez les champs signalés. Votre saisie est conservée.",
      fieldErrors: toFieldErrors(parsed.error.issues),
      values: raw,
    };
  }

  // Le code figure sur les conventions et les dossiers de financement : deux
  // formations partageant le même rendraient les documents ambigus.
  if (parsed.data.code) {
    const clash = await prisma.program.findUnique({
      where: { code: parsed.data.code },
      select: { title: true },
    });
    if (clash) {
      return {
        success: false,
        message: `Ce code est déjà utilisé par « ${clash.title} ».`,
        fieldErrors: { code: "Code déjà utilisé." },
        values: raw,
      };
    }
  }

  // La composition n'est disponible qu'après la création. Un nouveau
  // programme est donc toujours un brouillon, même si un client forgé envoie
  // ACTIVE dans le formulaire.
  const program = await prisma.program.create({
    data: { ...parsed.data, status: "DRAFT" },
  });

  await createAuditLog({
    actorId: actor.userId,
    action: "program.create",
    targetType: "Program",
    targetId: program.id,
    metadata: { title: program.title, code: program.code },
  });

  revalidatePath("/admin/formations");
  return {
    success: true,
    programId: program.id,
    message: "Programme de formation créé en brouillon. Ajoutez au moins un cours avant de l’activer.",
  };
}

export async function updateProgram(
  programId: string,
  _prev: ProgramActionResult,
  formData: FormData,
): Promise<ProgramActionResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole(...adminRolesForScreen("/admin/formations"));
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  const current = await prisma.program.findUnique({
    where: { id: programId },
    select: { id: true, code: true, status: true },
  });
  if (!current) return { success: false, message: "Programme de formation introuvable." };

  const raw = readProgramForm(formData);
  const parsed = programSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Corrigez les champs signalés. Votre saisie est conservée.",
      fieldErrors: toFieldErrors(parsed.error.issues),
      values: raw,
    };
  }

  if (parsed.data.code && parsed.data.code !== current.code) {
    const clash = await prisma.program.findUnique({
      where: { code: parsed.data.code },
      select: { id: true, title: true },
    });
    if (clash && clash.id !== programId) {
      return {
        success: false,
        message: `Ce code est déjà utilisé par « ${clash.title} ».`,
        fieldErrors: { code: "Code déjà utilisé." },
        values: raw,
      };
    }
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        if (parsed.data.status === "ACTIVE") {
          const courseCount = await tx.programCourse.count({ where: { programId } });
          if (!canActivateProgram(courseCount)) throw new ActiveProgramWithoutCourseError();
        }
        await tx.program.update({ where: { id: programId }, data: parsed.data });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof ActiveProgramWithoutCourseError) {
      return {
        success: false,
        message: ACTIVE_PROGRAM_REQUIRES_COURSE,
        fieldErrors: { status: ACTIVE_PROGRAM_REQUIRES_COURSE },
        values: raw,
      };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return { success: false, message: "Modification concurrente détectée. Réessayez." };
    }
    throw error;
  }

  await createAuditLog({
    actorId: actor.userId,
    action: "program.update",
    targetType: "Program",
    targetId: programId,
    metadata: {
      title: parsed.data.title,
      statusFrom: current.status,
      statusTo: parsed.data.status,
    },
  });

  revalidatePath("/admin/formations");
  revalidatePath(`/admin/formations/${programId}`);
  return { success: true, programId, message: "Programme de formation mis à jour." };
}

/** Supprime uniquement un programme qui n'a jamais porté de session. */
export async function deleteProgram(programId: string): Promise<ProgramActionResult> {
  return executeProgramDeletion(
    {
      authorize: () => requireAnyAdminRole(...adminRolesForScreen("/admin/formations")),
      deleteIfUnused: (id) =>
        prisma.$transaction(
          async (tx) => {
            const program = await tx.program.findUnique({
              where: { id },
              select: {
                id: true,
                title: true,
                code: true,
                sessions: { select: { id: true, _count: { select: { registrations: true } } } },
              },
            });
            if (!program) return null;

            // Ce qui protège l'historique, c'est l'INSCRIPTION, pas la session.
            // Une session ayant porté ne serait-ce qu'une inscription engage une
            // convention, une feuille d'émargement et parfois une attestation :
            // elle n'est jamais détruite. Une session restée vide n'est qu'un
            // brouillon de planification — bloquer dessus rendait tout programme
            // d'essai définitivement indéboulonnable.
            if (program.sessions.some((session) => session._count.registrations > 0)) {
              return "blocked" as const;
            }
            if (program.sessions.length > 0) {
              // `TrainingSession.program` est en `Restrict` : les sessions vides
              // doivent partir explicitement avant le programme. Le `Restrict`
              // de `Registration.session` reste le garde-fou en base si une
              // inscription se glissait entre la lecture et la suppression.
              await tx.trainingSession.deleteMany({ where: { programId: program.id } });
            }

            // ProgramCourse est en cascade : seule la composition sans historique
            // est nettoyée avec le programme. Les cours eux-mêmes sont conservés.
            await tx.program.delete({ where: { id: program.id } });
            return { id: program.id, title: program.title, code: program.code };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      audit: createAuditLog,
      revalidate: revalidatePath,
    },
    programId,
  );
}

/** Ajoute un cours à la composition d'une formation. */
export async function addCourseToProgram(
  programId: string,
  courseId: string,
): Promise<ProgramActionResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole(...adminRolesForScreen("/admin/formations"));
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  const [program, course] = await Promise.all([
    prisma.program.findUnique({ where: { id: programId }, select: { id: true, title: true } }),
    prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } }),
  ]);
  if (!program || !course) return { success: false, message: "Programme ou formation introuvable." };

  // Position = fin de liste. `_max` plutôt qu'un count : après un retrait, le
  // nombre d'éléments ne correspond plus à la dernière position utilisée, et
  // deux cours se retrouveraient au même rang.
  const last = await prisma.programCourse.aggregate({
    where: { programId },
    _max: { position: true },
  });

  await prisma.programCourse.create({
    data: { programId, courseId, position: (last._max.position ?? -1) + 1 },
  });

  await createAuditLog({
    actorId: actor.userId,
    action: "program.course_add",
    targetType: "Program",
    targetId: programId,
    metadata: { program: program.title, course: course.title },
  });

  revalidatePath(`/admin/formations/${programId}`);
  return { success: true, programId, message: `« ${course.title} » ajouté.` };
}

/** Retire un cours de la composition d'une formation. */
export async function removeCourseFromProgram(
  programId: string,
  courseId: string,
): Promise<ProgramActionResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole(...adminRolesForScreen("/admin/formations"));
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  let removed;
  try {
    removed = await prisma.$transaction(
      async (tx) => {
        const link = await tx.programCourse.findUnique({
          where: { programId_courseId: { programId, courseId } },
          include: {
            course: { select: { title: true } },
            program: { select: { status: true } },
          },
        });
        if (!link) return { kind: "missing" as const };

        if (link.program.status === "ACTIVE") {
          const courseCount = await tx.programCourse.count({ where: { programId } });
          if (!canActivateProgram(courseCount - 1)) return { kind: "last-active" as const };
        }

        await tx.programCourse.delete({
          where: { programId_courseId: { programId, courseId } },
        });
        return { kind: "removed" as const, title: link.course.title };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return { success: false, message: "Modification concurrente détectée. Réessayez." };
    }
    throw error;
  }

  if (removed.kind === "missing") {
    return { success: false, message: "Cette formation ne fait pas partie du programme." };
  }
  if (removed.kind === "last-active") {
    return {
      success: false,
      message: `${ACTIVE_PROGRAM_REQUIRES_COURSE} Passez-le en brouillon avant de retirer son dernier cours.`,
    };
  }

  await createAuditLog({
    actorId: actor.userId,
    action: "program.course_remove",
    targetType: "Program",
    targetId: programId,
    metadata: { course: removed.title },
  });

  revalidatePath(`/admin/formations/${programId}`);
  return { success: true, programId, message: `« ${removed.title} » retiré.` };
}

class ActiveProgramWithoutCourseError extends Error {}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

function readSessionForm(formData: FormData) {
  const get = (k: string) => (formData.get(k) as string | null) ?? "";
  return {
    programId: get("programId"),
    reference: get("reference"),
    startDate: get("startDate"),
    endDate: get("endDate"),
    location: get("location"),
    capacity: get("capacity"),
    status: get("status") || "PLANNED",
    notes: get("notes"),
  };
}

export async function createTrainingSession(
  _prev: ProgramActionResult,
  formData: FormData,
): Promise<ProgramActionResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole(...adminRolesForScreen("/admin/formations"));
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  const raw = readSessionForm(formData);
  const parsed = sessionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Corrigez les champs signalés. Votre saisie est conservée.",
      fieldErrors: toFieldErrors(parsed.error.issues),
      values: raw,
    };
  }

  const program = await prisma.program.findUnique({
    where: { id: parsed.data.programId },
    select: { id: true, title: true, status: true },
  });
  if (!program || program.status === "ARCHIVED") {
    return {
      success: false,
      message: "Programme de formation invalide ou archivé.",
      fieldErrors: { programId: "Sélectionnez un programme actif." },
      values: raw,
    };
  }

  const session = await prisma.trainingSession.create({
    data: {
      programId: parsed.data.programId,
      reference: parsed.data.reference,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      location: parsed.data.location,
      capacity: parsed.data.capacity,
      status: parsed.data.status,
      notes: parsed.data.notes,
    },
  });

  await createAuditLog({
    actorId: actor.userId,
    action: "session.create",
    targetType: "TrainingSession",
    targetId: session.id,
    metadata: {
      program: program.title,
      reference: session.reference,
      startDate: session.startDate.toISOString(),
      endDate: session.endDate.toISOString(),
    },
  });

  revalidatePath(`/admin/formations/${parsed.data.programId}`);
  return { success: true, programId: parsed.data.programId, message: "Session créée." };
}

export async function setSessionStatus(
  sessionId: string,
  status: "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED",
): Promise<ProgramActionResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole(...adminRolesForScreen("/admin/formations"));
  } catch {
    return { success: false, message: "Accès refusé." };
  }

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, programId: true, status: true, reference: true },
  });
  if (!session) return { success: false, message: "Session introuvable." };

  await prisma.trainingSession.update({ where: { id: sessionId }, data: { status } });

  await createAuditLog({
    actorId: actor.userId,
    action: "session.status",
    targetType: "TrainingSession",
    targetId: sessionId,
    metadata: { reference: session.reference, from: session.status, to: status },
  });

  revalidatePath(`/admin/formations/${session.programId}`);
  return { success: true, programId: session.programId, message: "Statut mis à jour." };
}
