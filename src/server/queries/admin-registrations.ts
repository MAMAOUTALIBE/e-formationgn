import "server-only";

// Lectures des inscriptions.

import { prisma } from "@/lib/prisma";

/** Inscriptions d'un élève, avec le contexte formation / session. */
export async function getStudentRegistrations(studentId: string) {
  return prisma.registration.findMany({
    where: { studentId },
    orderBy: { registeredAt: "desc" },
    select: {
      id: true,
      status: true,
      registeredAt: true,
      session: {
        select: {
          id: true,
          reference: true,
          startDate: true,
          endDate: true,
          status: true,
          program: {
            select: {
              id: true,
              title: true,
              _count: { select: { courses: true } },
            },
          },
        },
      },
    },
  });
}

/**
 * Sessions auxquelles on peut encore inscrire quelqu'un.
 *
 * Les sessions annulées et terminées sont exclues : y inscrire un élève
 * n'aurait aucun sens et fausserait les effectifs.
 */
export async function listOpenSessions() {
  const sessions = await prisma.trainingSession.findMany({
    where: { status: { in: ["PLANNED", "ACTIVE"] } },
    select: {
      id: true,
      reference: true,
      startDate: true,
      endDate: true,
      capacity: true,
      program: { select: { title: true } },
      _count: { select: { registrations: true } },
    },
    orderBy: { startDate: "asc" },
    take: 200,
  });

  return sessions.map((s) => ({
    id: s.id,
    label: `${s.program.title} — ${s.reference ?? "session"}`,
    startDate: s.startDate,
    endDate: s.endDate,
    // Une session complète reste listée mais signalée : c'est plus clair que
    // de la faire disparaître sans explication.
    full: s.capacity !== null && s._count.registrations >= s.capacity,
    seatsLeft: s.capacity === null ? null : s.capacity - s._count.registrations,
  }));
}

/** Inscriptions d'une session, pour la fiche formation. */
export async function getSessionRegistrations(sessionId: string) {
  return prisma.registration.findMany({
    where: { sessionId },
    orderBy: { registeredAt: "asc" },
    select: {
      id: true,
      status: true,
      student: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          company: { select: { id: true, name: true } },
        },
      },
    },
  });
}
