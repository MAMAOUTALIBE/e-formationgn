"use server";

import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { requireAnyAdminRole } from "@/lib/auth/authorization";
import {
  canTransitionVirtualClass,
  virtualClassCanBeOpened,
} from "@/lib/domain/virtual-class";
import {
  closeLiveKitRoom,
  ensureLiveKitRoom,
  isLiveKitConfigured,
  removeLiveKitParticipant,
  startRoomRecording,
  stopRoomRecording,
  updateStudentPublishing,
} from "@/lib/livekit/server";
import { prisma } from "@/lib/prisma";
import { managedCourseObjectFromUrl } from "@/lib/storage/course-media-provenance";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  cancelVirtualClassSchema,
  virtualClassFormSchema,
  virtualClassMessageSchema,
  virtualClassResourceSchema,
} from "@/lib/validators/virtual-class";
import { createAuditLog } from "@/server/services/audit-log";
import { notifyVirtualClass } from "@/server/services/virtual-class-notifications";
import {
  requireVirtualClassAccess,
  requireVirtualClassModerator,
  VirtualClassAccessError,
} from "@/server/services/virtual-class-access";

export interface VirtualClassActionResult {
  success: boolean;
  message?: string;
  virtualClassId?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string | boolean>;
}

function fields(issues: { path: PropertyKey[]; message: string }[]) {
  return Object.fromEntries(
    issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]),
  );
}

function readVirtualClassForm(formData: FormData) {
  const get = (key: string) => String(formData.get(key) ?? "");
  return {
    title: get("title"),
    description: get("description"),
    agenda: get("agenda"),
    trainingSessionId: get("trainingSessionId"),
    instructorId: get("instructorId"),
    startsAt: get("startsAt"),
    durationMinutes: get("durationMinutes"),
    timezone: get("timezone") || "Europe/Paris",
    maxParticipants: get("maxParticipants"),
    earlyJoinMinutes: get("earlyJoinMinutes") || "15",
    recordingEnabled: formData.get("recordingEnabled") === "on",
    status: get("status") || "DRAFT",
  };
}

async function validateRelations(trainingSessionId: string, instructorId: string) {
  const [trainingSession, instructor] = await Promise.all([
    prisma.trainingSession.findUnique({
      where: { id: trainingSessionId },
      select: { id: true, status: true, startDate: true, endDate: true },
    }),
    prisma.user.findUnique({
      where: { id: instructorId },
      select: { id: true, role: true, isInstructor: true, status: true },
    }),
  ]);
  if (!trainingSession || trainingSession.status === "CANCELLED") {
    return { error: "La session sélectionnée est introuvable ou annulée." } as const;
  }
  if (
    !instructor ||
    instructor.status !== "ACTIVE" ||
    (!instructor.isInstructor && instructor.role !== "INSTRUCTOR" && instructor.role !== "ADMIN")
  ) {
    return { error: "Le formateur sélectionné n’est pas actif ou habilité." } as const;
  }
  return { trainingSession, instructor } as const;
}

export async function createVirtualClass(
  _previous: VirtualClassActionResult,
  formData: FormData,
): Promise<VirtualClassActionResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole("ADMIN", "MANAGER");
  } catch {
    return { success: false, message: "Accès refusé." };
  }
  const submitted = readVirtualClassForm(formData);
  const openNow = formData.get("intent") === "OPEN_NOW";
  const requestedAt = new Date();
  const raw = openNow
    ? {
        ...submitted,
        startsAt: requestedAt.toISOString(),
        earlyJoinMinutes: "0",
        status: "SCHEDULED",
      }
    : submitted;
  const parsed = virtualClassFormSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Corrigez les champs signalés.",
      fieldErrors: fields(parsed.error.issues),
      values: submitted,
    };
  }
  const relations = await validateRelations(
    parsed.data.trainingSessionId,
    parsed.data.instructorId,
  );
  if ("error" in relations) {
    return { success: false, message: relations.error, values: submitted };
  }
  if (
    parsed.data.startsAt < relations.trainingSession.startDate ||
    parsed.data.scheduledEndAt > relations.trainingSession.endDate
  ) {
    return {
      success: false,
      message: "La classe doit se dérouler pendant les dates de la session.",
      fieldErrors: { startsAt: "Date hors de la session de formation." },
      values: submitted,
    };
  }

  if (openNow && !isLiveKitConfigured()) {
    return {
      success: false,
      message: "LiveKit n’est pas configuré. La classe instantanée ne peut pas être ouverte.",
      values: submitted,
    };
  }

  const virtualClassId = nanoid(24);
  const livekitRoomName = `aiduca-${nanoid(22)}`;
  if (openNow) {
    try {
      await ensureLiveKitRoom({
        name: livekitRoomName,
        maxParticipants: parsed.data.maxParticipants,
        metadata: { virtualClassId },
      });
    } catch {
      return {
        success: false,
        message: "La salle instantanée n’a pas pu être préparée. Réessayez dans quelques instants.",
        values: submitted,
      };
    }
  }

  let virtualClass;
  try {
    virtualClass = await prisma.$transaction(async (tx) => {
      const created = await tx.virtualClassSession.create({
        data: {
          ...parsed.data,
          id: virtualClassId,
          livekitRoomName,
          status: openNow ? "OPEN" : parsed.data.status,
          openedAt: openNow ? requestedAt : null,
          createdById: actor.userId,
        },
      });
      const registrations = await tx.registration.findMany({
        where: { sessionId: created.trainingSessionId, status: { not: "CANCELLED" } },
        select: { studentId: true },
      });
      await tx.virtualClassAttendance.createMany({
        data: [
          ...registrations.map((registration) => ({
            virtualClassId: created.id,
            userId: registration.studentId,
            role: "STUDENT" as const,
          })),
          { virtualClassId: created.id, userId: created.instructorId, role: "INSTRUCTOR" as const },
        ],
        skipDuplicates: true,
      });
      return created;
    });
  } catch {
    if (openNow) await closeLiveKitRoom(livekitRoomName).catch(() => undefined);
    return {
      success: false,
      message: "La classe virtuelle n’a pas pu être créée.",
      values: submitted,
    };
  }

  await createAuditLog({
    actorId: actor.userId,
    action: "virtual_class.create",
    targetType: "VirtualClassSession",
    targetId: virtualClass.id,
    metadata: {
      status: virtualClass.status,
      startsAt: virtualClass.startsAt.toISOString(),
      instant: openNow,
    },
  });
  revalidateVirtualClass(virtualClass.id);
  if (virtualClass.status === "SCHEDULED" || openNow) {
    await notifyVirtualClass({ virtualClassId: virtualClass.id, kind: "CONFIRMATION", keySuffix: "scheduled" }).catch(() => undefined);
  }
  return {
    success: true,
    virtualClassId: virtualClass.id,
    message: openNow
      ? "Classe virtuelle créée et salle ouverte."
      : virtualClass.status === "SCHEDULED"
        ? "Classe virtuelle programmée."
        : "Brouillon créé.",
  };
}

export async function updateVirtualClass(
  virtualClassId: string,
  _previous: VirtualClassActionResult,
  formData: FormData,
): Promise<VirtualClassActionResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole("ADMIN", "MANAGER");
  } catch {
    return { success: false, message: "Accès refusé." };
  }
  const current = await prisma.virtualClassSession.findUnique({ where: { id: virtualClassId } });
  if (!current) return { success: false, message: "Classe virtuelle introuvable." };
  if (!["DRAFT", "SCHEDULED"].includes(current.status)) {
    return { success: false, message: "Une séance ouverte ou terminée ne peut plus être reprogrammée." };
  }
  const raw = readVirtualClassForm(formData);
  const parsed = virtualClassFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: "Corrigez les champs signalés.", fieldErrors: fields(parsed.error.issues), values: raw };
  }
  if (!canTransitionVirtualClass(current.status, parsed.data.status)) {
    return { success: false, message: "Transition de statut interdite.", values: raw };
  }
  const relations = await validateRelations(parsed.data.trainingSessionId, parsed.data.instructorId);
  if ("error" in relations) return { success: false, message: relations.error, values: raw };
  if (parsed.data.startsAt < relations.trainingSession.startDate || parsed.data.scheduledEndAt > relations.trainingSession.endDate) {
    return { success: false, message: "La classe doit se dérouler pendant les dates de la session.", values: raw };
  }

  await prisma.$transaction(async (tx) => {
    await tx.virtualClassSession.update({ where: { id: virtualClassId }, data: parsed.data });
    if (current.trainingSessionId !== parsed.data.trainingSessionId) {
      const registrations = await tx.registration.findMany({
        where: { sessionId: parsed.data.trainingSessionId, status: { not: "CANCELLED" } },
        select: { studentId: true },
      });
      await tx.virtualClassAttendance.deleteMany({
        where: { virtualClassId, firstJoinedAt: null },
      });
      await tx.virtualClassAttendance.createMany({
        data: registrations.map((registration) => ({
          virtualClassId,
          userId: registration.studentId,
          role: "STUDENT" as const,
        })),
        skipDuplicates: true,
      });
    }
    await tx.virtualClassAttendance.upsert({
      where: { virtualClassId_userId: { virtualClassId, userId: parsed.data.instructorId } },
      create: { virtualClassId, userId: parsed.data.instructorId, role: "INSTRUCTOR" },
      update: { role: "INSTRUCTOR" },
    });
    if (current.instructorId !== parsed.data.instructorId) {
      await tx.virtualClassAttendance.deleteMany({
        where: {
          virtualClassId,
          userId: current.instructorId,
          firstJoinedAt: null,
        },
      });
    }
  });
  await createAuditLog({
    actorId: actor.userId,
    action: "virtual_class.update",
    targetType: "VirtualClassSession",
    targetId: virtualClassId,
    metadata: { statusFrom: current.status, statusTo: parsed.data.status },
  });
  revalidateVirtualClass(virtualClassId);
  if (parsed.data.status === "SCHEDULED") {
    const updated = await prisma.virtualClassSession.findUnique({ where: { id: virtualClassId }, select: { updatedAt: true } });
    if (updated) await notifyVirtualClass({ virtualClassId, kind: "UPDATED", keySuffix: updated.updatedAt.toISOString() }).catch(() => undefined);
  }
  return { success: true, virtualClassId, message: "Classe virtuelle mise à jour." };
}

export async function duplicateVirtualClass(virtualClassId: string): Promise<VirtualClassActionResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole("ADMIN", "MANAGER");
  } catch {
    return { success: false, message: "Accès refusé." };
  }
  const source = await prisma.virtualClassSession.findUnique({
    where: { id: virtualClassId },
    include: {
      attendances: { select: { userId: true, role: true } },
      resources: true,
    },
  });
  if (!source) return { success: false, message: "Classe virtuelle introuvable." };

  const duplicate = await prisma.$transaction(async (tx) => {
    const created = await tx.virtualClassSession.create({
      data: {
        title: `${source.title} — copie`,
        description: source.description,
        agenda: source.agenda,
        trainingSessionId: source.trainingSessionId,
        instructorId: source.instructorId,
        startsAt: source.startsAt,
        scheduledEndAt: source.scheduledEndAt,
        durationMinutes: source.durationMinutes,
        timezone: source.timezone,
        maxParticipants: source.maxParticipants,
        earlyJoinMinutes: source.earlyJoinMinutes,
        recordingEnabled: source.recordingEnabled,
        status: "DRAFT",
        livekitRoomName: `aiduca-${nanoid(22)}`,
        createdById: actor.userId,
      },
    });
    if (source.attendances.length) {
      await tx.virtualClassAttendance.createMany({
        data: source.attendances.map((attendance) => ({
          virtualClassId: created.id,
          userId: attendance.userId,
          role: attendance.role,
        })),
        skipDuplicates: true,
      });
    }
    if (source.resources.length) {
      await tx.virtualClassResource.createMany({
        data: source.resources.map((resource) => ({
          virtualClassId: created.id,
          authorId: actor.userId,
          title: resource.title,
          description: resource.description,
          storageUrl: resource.storageUrl,
          contentType: resource.contentType,
          fileSizeBytes: resource.fileSizeBytes,
          visibility: resource.visibility,
          downloadable: resource.downloadable,
        })),
      });
    }
    return created;
  });
  await createAuditLog({
    actorId: actor.userId,
    action: "virtual_class.duplicate",
    targetType: "VirtualClassSession",
    targetId: duplicate.id,
    metadata: { sourceId: source.id },
  });
  revalidateVirtualClass(duplicate.id);
  return { success: true, virtualClassId: duplicate.id, message: "Copie créée en brouillon." };
}

export async function deleteVirtualClass(virtualClassId: string): Promise<VirtualClassActionResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole("ADMIN", "MANAGER");
  } catch {
    return { success: false, message: "Accès refusé." };
  }
  const current = await prisma.virtualClassSession.findUnique({
    where: { id: virtualClassId },
    select: {
      status: true,
      _count: { select: { messages: true, recordings: true } },
      attendances: { where: { firstJoinedAt: { not: null } }, select: { id: true }, take: 1 },
    },
  });
  if (!current) return { success: false, message: "Classe virtuelle introuvable." };
  if (current.status !== "DRAFT" || current.attendances.length || current._count.messages || current._count.recordings) {
    return { success: false, message: "Seul un brouillon sans activité peut être supprimé." };
  }
  await prisma.virtualClassSession.delete({ where: { id: virtualClassId } });
  await createAuditLog({
    actorId: actor.userId,
    action: "virtual_class.delete",
    targetType: "VirtualClassSession",
    targetId: virtualClassId,
  });
  revalidatePath("/admin/classes-virtuelles");
  return { success: true, message: "Brouillon supprimé." };
}

export async function openVirtualClass(virtualClassId: string): Promise<VirtualClassActionResult> {
  try {
    const { session, virtualClass } = await requireVirtualClassModerator(virtualClassId);
    const full = await prisma.virtualClassSession.findUnique({ where: { id: virtualClass.id } });
    if (!full) return { success: false, message: "Classe virtuelle introuvable." };
    if (!virtualClassCanBeOpened({ ...full, allowBeforeOpeningWindow: true })) {
      return { success: false, message: "Seule une séance programmée et non terminée peut être ouverte." };
    }
    if (!isLiveKitConfigured()) {
      return { success: false, message: "LiveKit n’est pas configuré. La salle ne peut pas être ouverte." };
    }
    await ensureLiveKitRoom({
      name: full.livekitRoomName,
      maxParticipants: full.maxParticipants,
      metadata: { virtualClassId: full.id },
    });
    await prisma.virtualClassSession.update({
      where: { id: full.id },
      data: { status: "OPEN", openedAt: new Date() },
    });
    await createAuditLog({ actorId: session.userId, action: "virtual_class.open", targetType: "VirtualClassSession", targetId: full.id });
    revalidateVirtualClass(full.id);
    return { success: true, virtualClassId: full.id, message: "Salle ouverte." };
  } catch (error) {
    return actionError(error);
  }
}

export async function sendVirtualClassLinkToLearners(
  virtualClassId: string,
): Promise<VirtualClassActionResult> {
  try {
    const { session, virtualClass } = await requireVirtualClassModerator(virtualClassId);
    if (!["SCHEDULED", "OPEN", "LIVE"].includes(virtualClass.status)) {
      return {
        success: false,
        message: virtualClass.status === "DRAFT"
          ? "Programmez la classe avant d’envoyer le lien aux apprenants."
          : "Le lien ne peut plus être envoyé pour cette séance.",
      };
    }

    const rateLimit = await checkRateLimit({
      key: `virtual-class-link:${session.userId}:${virtualClass.id}`,
      windowMs: 15 * 60 * 1000,
      max: 3,
    });
    if (!rateLimit.ok) {
      return {
        success: false,
        message: "Le lien a déjà été envoyé plusieurs fois. Réessayez dans quelques minutes.",
      };
    }

    const delivery = await notifyVirtualClass({
      virtualClassId: virtualClass.id,
      kind: "CONFIRMATION",
      keySuffix: `manual:${nanoid(12)}`,
      audience: "LEARNERS",
    });
    if (!delivery.sent) {
      return {
        success: false,
        message: "Aucun apprenant actif n’est inscrit à cette session.",
      };
    }

    await createAuditLog({
      actorId: session.userId,
      action: "virtual_class.link.send",
      targetType: "VirtualClassSession",
      targetId: virtualClass.id,
      metadata: { notified: delivery.sent, emailed: delivery.emailed },
    });

    const learnersLabel = `${delivery.sent} apprenant${delivery.sent > 1 ? "s" : ""}`;
    const message = delivery.emailed === delivery.sent
      ? `Lien envoyé à ${learnersLabel} par e-mail et dans Aiduca.`
      : delivery.emailed > 0
        ? `Lien envoyé dans Aiduca à ${learnersLabel}, dont ${delivery.emailed} également par e-mail.`
        : `Lien envoyé dans Aiduca à ${learnersLabel}. L’envoi par e-mail n’est pas configuré.`;
    return { success: true, virtualClassId: virtualClass.id, message };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelVirtualClass(virtualClassId: string, formData: FormData): Promise<VirtualClassActionResult> {
  let actor;
  try {
    actor = await requireAnyAdminRole("ADMIN", "MANAGER");
  } catch {
    return { success: false, message: "Accès refusé." };
  }
  const parsed = cancelVirtualClassSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message };
  const current = await prisma.virtualClassSession.findUnique({ where: { id: virtualClassId } });
  if (!current) return { success: false, message: "Classe virtuelle introuvable." };
  if (!canTransitionVirtualClass(current.status, "CANCELLED")) {
    return { success: false, message: "Cette séance ne peut plus être annulée." };
  }
  await prisma.virtualClassSession.update({
    where: { id: virtualClassId },
    data: { status: "CANCELLED", cancellationReason: parsed.data.reason },
  });
  if (isLiveKitConfigured() && ["OPEN", "LIVE"].includes(current.status)) {
    await closeLiveKitRoom(current.livekitRoomName).catch(() => undefined);
  }
  await createAuditLog({ actorId: actor.userId, action: "virtual_class.cancel", targetType: "VirtualClassSession", targetId: virtualClassId, metadata: { reason: parsed.data.reason } });
  revalidateVirtualClass(virtualClassId);
  await notifyVirtualClass({ virtualClassId, kind: "CANCELLED", keySuffix: "cancelled" }).catch(() => undefined);
  return { success: true, virtualClassId, message: "Séance annulée." };
}

export async function endVirtualClass(virtualClassId: string): Promise<VirtualClassActionResult> {
  try {
    const { session, virtualClass } = await requireVirtualClassModerator(virtualClassId);
    if (!canTransitionVirtualClass(virtualClass.status, "ENDED")) {
      return { success: false, message: "Cette séance ne peut pas être terminée dans son état actuel." };
    }
    if (isLiveKitConfigured()) await closeLiveKitRoom(virtualClass.livekitRoomName);
    await prisma.virtualClassSession.update({ where: { id: virtualClassId }, data: { status: "ENDED", endedAt: new Date() } });
    await createAuditLog({ actorId: session.userId, action: "virtual_class.end", targetType: "VirtualClassSession", targetId: virtualClassId });
    revalidateVirtualClass(virtualClassId);
    return { success: true, virtualClassId, message: "Séance terminée pour tous." };
  } catch (error) {
    return actionError(error);
  }
}

export async function moderateVirtualClassParticipant(input: {
  virtualClassId: string;
  userId: string;
  action: "ALLOW_MIC" | "REVOKE_MEDIA" | "REMOVE";
}): Promise<VirtualClassActionResult> {
  try {
    const { session, virtualClass } = await requireVirtualClassModerator(input.virtualClassId);
    const target = await prisma.virtualClassAttendance.findUnique({
      where: { virtualClassId_userId: { virtualClassId: input.virtualClassId, userId: input.userId } },
      select: { role: true },
    });
    if (!target || target.role !== "STUDENT") {
      return { success: false, message: "Participant apprenant introuvable." };
    }
    if (input.action === "REMOVE") {
      await removeLiveKitParticipant(virtualClass.livekitRoomName, input.userId);
    } else {
      await updateStudentPublishing({
        roomName: virtualClass.livekitRoomName,
        userId: input.userId,
        allowMicrophone: input.action === "ALLOW_MIC",
      });
    }
    await createAuditLog({ actorId: session.userId, action: `virtual_class.moderation.${input.action.toLowerCase()}`, targetType: "User", targetId: input.userId, metadata: { virtualClassId: input.virtualClassId } });
    return { success: true, virtualClassId: input.virtualClassId, message: "Permission mise à jour." };
  } catch (error) {
    return actionError(error);
  }
}

export async function createVirtualClassMessage(input: { virtualClassId: string; content: string; type: "MESSAGE" | "QUESTION" }): Promise<VirtualClassActionResult> {
  try {
    const { user, virtualClass } = await requireVirtualClassAccess(input.virtualClassId);
    const parsed = virtualClassMessageSchema.safeParse({ content: input.content, type: input.type });
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Message invalide." };
    await prisma.virtualClassMessage.create({ data: { virtualClassId: virtualClass.id, authorId: user.id, ...parsed.data } });
    revalidateVirtualClass(virtualClass.id);
    return { success: true, virtualClassId: virtualClass.id, message: "Message envoyé." };
  } catch (error) { return actionError(error); }
}

export async function addVirtualClassResource(input: {
  virtualClassId: string;
  title: string;
  description?: string;
  storageUrl: string;
  contentType: string;
  fileSizeBytes: number;
  visibility: "BEFORE" | "DURING" | "AFTER" | "ALWAYS";
  downloadable: boolean;
}): Promise<VirtualClassActionResult> {
  try {
    const { session, virtualClass } = await requireVirtualClassModerator(input.virtualClassId);
    if (virtualClass.status === "ENDED" || virtualClass.status === "CANCELLED") {
      return { success: false, message: "Cette séance n’accepte plus de nouveaux documents." };
    }
    const parsed = virtualClassResourceSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Document invalide." };
    const managedObject = managedCourseObjectFromUrl(parsed.data.storageUrl, session.userId, {
      r2AccountId: process.env.R2_ACCOUNT_ID,
      r2Bucket: process.env.R2_BUCKET ?? "e-formationgn",
      r2PublicUrl: process.env.R2_PUBLIC_URL,
    });
    if (!managedObject || !managedObject.key.startsWith(`resources/virtual-classes/${session.userId}/`)) {
      return { success: false, message: "Le fichier ne provient pas d’un dépôt autorisé." };
    }
    const count = await prisma.virtualClassResource.count({ where: { virtualClassId: input.virtualClassId } });
    if (count >= 40) return { success: false, message: "Maximum 40 documents par séance." };
    const resource = await prisma.virtualClassResource.create({ data: { virtualClassId: input.virtualClassId, authorId: session.userId, ...parsed.data } });
    await createAuditLog({ actorId: session.userId, action: "virtual_class.resource.add", targetType: "VirtualClassResource", targetId: resource.id, metadata: { virtualClassId: input.virtualClassId } });
    revalidateVirtualClass(input.virtualClassId);
    return { success: true, virtualClassId: input.virtualClassId, message: "Document ajouté." };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteVirtualClassResource(resourceId: string): Promise<VirtualClassActionResult> {
  const resource = await prisma.virtualClassResource.findUnique({ where: { id: resourceId }, select: { id: true, virtualClassId: true } });
  if (!resource) return { success: false, message: "Document introuvable." };
  try {
    const { session } = await requireVirtualClassModerator(resource.virtualClassId);
    await prisma.virtualClassResource.delete({ where: { id: resource.id } });
    await createAuditLog({ actorId: session.userId, action: "virtual_class.resource.delete", targetType: "VirtualClassResource", targetId: resource.id, metadata: { virtualClassId: resource.virtualClassId } });
    revalidateVirtualClass(resource.virtualClassId);
    return { success: true, virtualClassId: resource.virtualClassId, message: "Document retiré." };
  } catch (error) {
    return actionError(error);
  }
}

export async function startVirtualClassRecording(virtualClassId: string, acknowledged: boolean): Promise<VirtualClassActionResult> {
  if (!acknowledged) return { success: false, message: "Confirmez que l’information sur l’enregistrement est affichée aux participants." };
  try {
    const { session } = await requireVirtualClassModerator(virtualClassId);
    const full = await prisma.virtualClassSession.findUnique({ where: { id: virtualClassId }, select: { recordingEnabled: true, status: true, livekitRoomName: true } });
    if (!full) return { success: false, message: "Classe virtuelle introuvable." };
    if (!full.recordingEnabled) return { success: false, message: "L’enregistrement n’est pas autorisé pour cette séance." };
    if (full.status !== "OPEN" && full.status !== "LIVE") return { success: false, message: "La salle doit être ouverte pour enregistrer." };
    const active = await prisma.virtualClassRecording.findFirst({ where: { virtualClassId, status: { in: ["STARTING", "ACTIVE", "PROCESSING"] } } });
    if (active) return { success: false, message: "Un enregistrement est déjà en cours ou en traitement." };
    const started = await startRoomRecording({ roomName: full.livekitRoomName, virtualClassId });
    await prisma.virtualClassRecording.create({ data: { virtualClassId, egressId: started.egressId, storageKey: started.storageKey, status: "STARTING", startedAt: new Date() } });
    await createAuditLog({ actorId: session.userId, action: "virtual_class.recording.start", targetType: "VirtualClassSession", targetId: virtualClassId, metadata: { acknowledged: true, egressId: started.egressId } });
    revalidateVirtualClass(virtualClassId);
    return { success: true, virtualClassId, message: "Enregistrement démarré. Les participants doivent voir l’indicateur rouge." };
  } catch (error) { return actionError(error); }
}

export async function stopVirtualClassRecording(virtualClassId: string): Promise<VirtualClassActionResult> {
  try {
    const { session } = await requireVirtualClassModerator(virtualClassId);
    const recording = await prisma.virtualClassRecording.findFirst({ where: { virtualClassId, status: { in: ["STARTING", "ACTIVE"] } }, orderBy: { createdAt: "desc" } });
    if (!recording) return { success: false, message: "Aucun enregistrement actif." };
    await stopRoomRecording(recording.egressId);
    await prisma.virtualClassRecording.update({ where: { id: recording.id }, data: { status: "PROCESSING", endedAt: new Date() } });
    await createAuditLog({ actorId: session.userId, action: "virtual_class.recording.stop", targetType: "VirtualClassRecording", targetId: recording.id });
    revalidateVirtualClass(virtualClassId);
    return { success: true, virtualClassId, message: "Enregistrement arrêté et en traitement." };
  } catch (error) { return actionError(error); }
}

export async function publishVirtualClassReplay(recordingId: string, visible: boolean): Promise<VirtualClassActionResult> {
  const recording = await prisma.virtualClassRecording.findUnique({ where: { id: recordingId }, select: { id: true, virtualClassId: true, status: true } });
  if (!recording) return { success: false, message: "Replay introuvable." };
  try {
    const { session } = await requireVirtualClassModerator(recording.virtualClassId);
    if (recording.status !== "READY") return { success: false, message: "Le replay n’est pas encore prêt." };
    await prisma.virtualClassRecording.update({ where: { id: recording.id }, data: { visible, publishedAt: visible ? new Date() : null, publishedById: visible ? session.userId : null } });
    await createAuditLog({ actorId: session.userId, action: visible ? "virtual_class.replay.publish" : "virtual_class.replay.unpublish", targetType: "VirtualClassRecording", targetId: recording.id });
    if (visible) await notifyVirtualClass({ virtualClassId: recording.virtualClassId, kind: "REPLAY_AVAILABLE", keySuffix: recording.id }).catch(() => undefined);
    revalidateVirtualClass(recording.virtualClassId);
    return { success: true, virtualClassId: recording.virtualClassId, message: visible ? "Replay publié." : "Replay rendu privé." };
  } catch (error) { return actionError(error); }
}

function revalidateVirtualClass(id: string) {
  revalidatePath("/admin/classes-virtuelles");
  revalidatePath(`/admin/classes-virtuelles/${id}`);
  revalidatePath("/formateur/classes-virtuelles");
  revalidatePath("/classes-virtuelles");
}

function actionError(error: unknown): VirtualClassActionResult {
  if (error instanceof VirtualClassAccessError) return { success: false, message: error.message };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    return { success: false, message: "Donnée introuvable ou modifiée entre-temps." };
  }
  return { success: false, message: "L’opération n’a pas pu aboutir." };
}
