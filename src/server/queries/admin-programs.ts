import "server-only";

// Lectures des formations (programmes) et de leurs sessions.

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface ProgramListRow {
  id: string;
  title: string;
  code: string | null;
  durationHours: number | null;
  status: string;
  courseCount: number;
  sessionCount: number;
}

export async function listPrograms(params: { search?: string; status?: string } = {}): Promise<
  ProgramListRow[]
> {
  const search = params.search?.trim();
  const where: Prisma.ProgramWhereInput = {
    ...(params.status &&
    ["DRAFT", "ACTIVE", "ARCHIVED"].includes(params.status)
      ? { status: params.status as "DRAFT" | "ACTIVE" | "ARCHIVED" }
      : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { code: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const programs = await prisma.program.findMany({
    where,
    select: {
      id: true,
      title: true,
      code: true,
      durationHours: true,
      status: true,
      _count: { select: { courses: true, sessions: true } },
    },
    orderBy: [{ status: "asc" }, { title: "asc" }],
  });

  return programs.map((p) => ({
    id: p.id,
    title: p.title,
    code: p.code,
    durationHours: p.durationHours,
    status: p.status,
    courseCount: p._count.courses,
    sessionCount: p._count.sessions,
  }));
}

/** Fiche formation : sa composition et ses sessions. */
export async function getProgramDetail(programId: string) {
  return prisma.program.findUnique({
    where: { id: programId },
    include: {
      courses: {
        include: {
          course: { select: { id: true, title: true, status: true, durationSeconds: true } },
        },
        orderBy: { position: "asc" },
      },
      sessions: {
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          reference: true,
          startDate: true,
          endDate: true,
          location: true,
          capacity: true,
          status: true,
        },
      },
    },
  });
}

/**
 * Cours proposables à l'ajout dans une formation.
 *
 * On exclut ceux déjà présents plutôt que de les afficher grisés : la liste
 * sert à ajouter, et la contrainte d'unicité les refuserait de toute façon.
 */
export async function listAssignableCourses(programId: string) {
  const already = await prisma.programCourse.findMany({
    where: { programId },
    select: { courseId: true },
  });
  return prisma.course.findMany({
    where: { id: { notIn: already.map((a) => a.courseId) } },
    select: { id: true, title: true, status: true },
    orderBy: { title: "asc" },
    take: 200,
  });
}

/** Formations proposables pour créer une session. */
export async function listSelectablePrograms() {
  return prisma.program.findMany({
    where: { status: { in: ["DRAFT", "ACTIVE"] } },
    select: { id: true, title: true, code: true },
    orderBy: { title: "asc" },
  });
}
