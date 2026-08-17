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
  registrationCount: number;
  upcomingSessionCount: number;
}

export async function listPrograms(params: { search?: string; status?: string; duration?: string } = {}): Promise<
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
    ...(params.duration === "short"
      ? { durationHours: { lt: 40 } }
      : params.duration === "medium"
        ? { durationHours: { gte: 40, lte: 100 } }
        : params.duration === "long"
          ? { durationHours: { gt: 100 } }
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
      courses: { select: { courseId: true } },
      sessions: {
        select: {
          startDate: true,
          status: true,
          _count: { select: { registrations: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { title: "asc" }],
  });

  const now = new Date();

  return programs.map((p) => ({
    id: p.id,
    title: p.title,
    code: p.code,
    durationHours: p.durationHours,
    status: p.status,
    courseCount: p._count.courses,
    sessionCount: p._count.sessions,
    registrationCount: p.sessions.reduce((sum, session) => sum + session._count.registrations, 0),
    upcomingSessionCount: p.sessions.filter((session) => session.startDate >= now && session.status !== "CANCELLED").length,
  }));
}

export async function getProgramsDashboardStats() {
  const now = new Date();
  const [total, active, draft, archived, upcomingSessions, registrations] = await Promise.all([
    prisma.program.count(),
    prisma.program.count({ where: { status: "ACTIVE" } }),
    prisma.program.count({ where: { status: "DRAFT" } }),
    prisma.program.count({ where: { status: "ARCHIVED" } }),
    prisma.trainingSession.count({ where: { startDate: { gte: now }, status: { in: ["PLANNED", "ACTIVE"] } } }),
    prisma.registration.count(),
  ]);
  return { total, active, draft, archived, upcomingSessions, registrations };
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
