import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { isReplayWithinRetention } from "@/lib/domain/virtual-class";
import { prisma } from "@/lib/prisma";

export const VIRTUAL_CLASS_LIST_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "OPEN",
  "LIVE",
  "ENDED",
  "CANCELLED",
] as const;

const listSelect = {
  id: true,
  title: true,
  startsAt: true,
  scheduledEndAt: true,
  durationMinutes: true,
  timezone: true,
  status: true,
  maxParticipants: true,
  recordingEnabled: true,
  trainingSession: {
    select: {
      id: true,
      reference: true,
      program: { select: { id: true, title: true } },
    },
  },
  instructor: {
    select: { id: true, name: true, firstName: true, lastName: true, email: true },
  },
  _count: { select: { attendances: true, resources: true, recordings: true } },
} satisfies Prisma.VirtualClassSessionSelect;

export async function listAdminVirtualClasses(params: {
  q?: string;
  status?: string;
  programId?: string;
  sessionId?: string;
  instructorId?: string;
  from?: Date;
  to?: Date;
} = {}) {
  const status = VIRTUAL_CLASS_LIST_STATUSES.includes(
    params.status as (typeof VIRTUAL_CLASS_LIST_STATUSES)[number],
  )
    ? (params.status as (typeof VIRTUAL_CLASS_LIST_STATUSES)[number])
    : undefined;
  return prisma.virtualClassSession.findMany({
    where: {
      ...(params.q?.trim()
        ? { title: { contains: params.q.trim(), mode: "insensitive" } }
        : {}),
      ...(status ? { status } : {}),
      ...(params.programId ? { trainingSession: { programId: params.programId } } : {}),
      ...(params.sessionId ? { trainingSessionId: params.sessionId } : {}),
      ...(params.instructorId ? { instructorId: params.instructorId } : {}),
      ...((params.from || params.to)
        ? { startsAt: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } }
        : {}),
    },
    select: listSelect,
    orderBy: { startsAt: "asc" },
  });
}

export async function listInstructorVirtualClasses(instructorId: string) {
  return prisma.virtualClassSession.findMany({
    where: { instructorId },
    select: listSelect,
    orderBy: { startsAt: "asc" },
  });
}

export async function listStudentVirtualClasses(userId: string) {
  const rows = await prisma.virtualClassSession.findMany({
    where: {
      trainingSession: {
        registrations: { some: { studentId: userId, status: { not: "CANCELLED" } } },
      },
    },
    select: {
      ...listSelect,
      trainingSession: {
        select: {
          id: true,
          reference: true,
          program: { select: { id: true, title: true } },
          registrations: {
            where: { studentId: userId },
            select: { status: true },
            take: 1,
          },
        },
      },
      attendances: {
        where: { userId },
        select: { status: true, totalSeconds: true, confirmed: true },
        take: 1,
      },
      recordings: {
        // `expiresAt` filtré ici aussi : sans ça la carte proposait encore un
        // bouton « replay » menant à une réponse 410.
        where: {
          status: "READY",
          visible: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { startsAt: "asc" },
  });
  return rows.map((row) => ({
    ...row,
    registrationStatus: row.trainingSession.registrations[0]?.status ?? null,
    attendance: row.attendances[0] ?? null,
    replayId: row.recordings[0]?.id ?? null,
  }));
}

export async function getVirtualClassDetail(id: string) {
  return prisma.virtualClassSession.findUnique({
    where: { id },
    include: {
      trainingSession: { include: { program: true } },
      instructor: { select: { id: true, name: true, firstName: true, lastName: true, email: true } },
      attendances: {
        include: {
          user: { select: { id: true, name: true, firstName: true, lastName: true, email: true, image: true } },
          connectionPeriods: { orderBy: { joinedAt: "desc" } },
        },
        orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
      },
      resources: { include: { author: { select: { name: true, email: true } } }, orderBy: { publishedAt: "desc" } },
      recordings: { orderBy: { createdAt: "desc" } },
      messages: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
}

export async function listVirtualClassFormOptions() {
  const [sessions, instructors] = await Promise.all([
    prisma.trainingSession.findMany({
      where: { status: { in: ["PLANNED", "ACTIVE"] } },
      select: { id: true, reference: true, startDate: true, endDate: true, program: { select: { id: true, title: true } } },
      orderBy: { startDate: "asc" },
      take: 300,
    }),
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ role: "INSTRUCTOR" }, { role: "ADMIN" }, { isInstructor: true }],
      },
      select: { id: true, name: true, firstName: true, lastName: true, email: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
  ]);
  return { sessions, instructors };
}

export async function getVirtualClassViewer(id: string, userId: string, role: string) {
  const virtualClass = await prisma.virtualClassSession.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      agenda: true,
      startsAt: true,
      scheduledEndAt: true,
      timezone: true,
      status: true,
      // Instants d'ouverture : le chronomètre de la salle s'y ancre, au lieu
      // de repartir de zéro à chaque montage du composant.
      openedAt: true,
      liveStartedAt: true,
      recordingEnabled: true,
      instructorId: true,
      instructor: { select: { name: true, firstName: true, lastName: true, email: true } },
      trainingSession: {
        select: {
          reference: true,
          program: { select: { title: true } },
          registrations: { where: { studentId: userId, status: "ACTIVE" }, select: { status: true }, take: 1 },
        },
      },
      resources: { select: { id: true, title: true, visibility: true, downloadable: true }, orderBy: { publishedAt: "desc" } },
      recordings: { select: { id: true, status: true, visible: true, expiresAt: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!virtualClass) return null;
  const isAdmin = role === "ADMIN" || role === "MANAGER";
  const isInstructor = virtualClass.instructorId === userId && (role === "INSTRUCTOR" || role === "ADMIN");
  const registration = virtualClass.trainingSession.registrations[0] ?? null;
  if (!isAdmin && !isInstructor && !registration) return null;
  return {
    ...virtualClass,
    viewerRole: isAdmin ? "ADMIN" as const : isInstructor ? "INSTRUCTOR" as const : "STUDENT" as const,
    registrationStatus: registration?.status ?? null,
    replayId:
      virtualClass.recordings.find(
        (recording) =>
          recording.status === "READY" &&
          recording.visible &&
          isReplayWithinRetention(recording.expiresAt),
      )?.id ?? null,
    recordingActive: virtualClass.recordings.some((recording) => recording.status === "STARTING" || recording.status === "ACTIVE"),
  };
}
