import "server-only";

import { resolveVirtualClassRoomRole, virtualClassJoinError } from "@/lib/domain/virtual-class";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth/authorization";

export class VirtualClassAccessError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "FORBIDDEN" | "NOT_OPEN" | "CAPACITY",
    message: string,
  ) {
    super(message);
    this.name = "VirtualClassAccessError";
  }
}

export async function requireVirtualClassAccess(virtualClassId: string) {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, firstName: true, lastName: true, email: true, role: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") {
    throw new VirtualClassAccessError("FORBIDDEN", "Ce compte n’est pas actif.");
  }

  const virtualClass = await prisma.virtualClassSession.findUnique({
    where: { id: virtualClassId },
    include: {
      trainingSession: {
        select: {
          id: true,
          program: { select: { id: true, title: true } },
        },
      },
    },
  });
  if (!virtualClass) {
    throw new VirtualClassAccessError("NOT_FOUND", "Classe virtuelle introuvable.");
  }

  const registration = user.role === "STUDENT" ? await prisma.registration.findFirst({
      where: {
        studentId: user.id,
        sessionId: virtualClass.trainingSessionId,
        status: "ACTIVE",
      },
      select: { id: true },
    }) : null;
  const roomRole = resolveVirtualClassRoomRole({ userRole: user.role, userId: user.id, instructorId: virtualClass.instructorId, hasActiveRegistration: Boolean(registration) });
  if (!roomRole) {
    throw new VirtualClassAccessError(
      "FORBIDDEN",
      "Vous ne disposez pas d’une inscription active ou d’une attribution pour cette séance.",
    );
  }

  const joinError = virtualClassJoinError(virtualClass);
  if (joinError) throw new VirtualClassAccessError("NOT_OPEN", joinError);

  const displayName =
    user.name ?? ([user.firstName, user.lastName].filter(Boolean).join(" ") || user.email);
  return { user, virtualClass, roomRole, displayName };
}

export async function requireVirtualClassModerator(virtualClassId: string) {
  const session = await requireSession();
  const virtualClass = await prisma.virtualClassSession.findUnique({
    where: { id: virtualClassId },
    select: { id: true, instructorId: true, livekitRoomName: true, status: true },
  });
  if (!virtualClass) {
    throw new VirtualClassAccessError("NOT_FOUND", "Classe virtuelle introuvable.");
  }
  const isVirtualClassAdmin = session.role === "ADMIN" || session.role === "MANAGER";
  if (!isVirtualClassAdmin && virtualClass.instructorId !== session.userId) {
    throw new VirtualClassAccessError("FORBIDDEN", "Action réservée au formateur attribué.");
  }
  return { session, virtualClass };
}
