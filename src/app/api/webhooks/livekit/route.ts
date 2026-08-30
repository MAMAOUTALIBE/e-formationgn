import { NextResponse } from "next/server";
import { EgressStatus } from "livekit-server-sdk";

import { Prisma } from "@/generated/prisma/client";
import { attendanceStatusForDuration } from "@/lib/domain/virtual-class";
import { getLiveKitWebhookReceiver, LiveKitConfigurationError, userIdFromLiveKitIdentity } from "@/lib/livekit/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  const authorization = request.headers.get("authorization") ?? request.headers.get("authorize") ?? undefined;
  let event;
  try {
    event = await getLiveKitWebhookReceiver().receive(body, authorization);
  } catch (error) {
    const message = error instanceof LiveKitConfigurationError ? "LiveKit non configuré." : "Signature LiveKit invalide.";
    return NextResponse.json({ error: message }, { status: error instanceof LiveKitConfigurationError ? 503 : 401 });
  }

  const eventId = `livekit:${event.id}`;
  const payload = safeJson(body);
  try {
    await prisma.webhookEvent.create({
      data: { id: eventId, source: "LIVEKIT", type: event.event, payload, status: "PROCESSING", attempts: 1 },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const previous = await prisma.webhookEvent.findUnique({ where: { id: eventId }, select: { status: true } });
      if (previous?.status !== "FAILED") return NextResponse.json({ received: true, duplicate: true });
      await prisma.webhookEvent.update({ where: { id: eventId }, data: { status: "PROCESSING", attempts: { increment: 1 }, lastError: null } });
    } else {
      return NextResponse.json({ error: "Webhook non enregistrable." }, { status: 500 });
    }
  }

  try {
    const roomName = event.room?.name || event.egressInfo?.roomName;
    const virtualClass = roomName
      ? await prisma.virtualClassSession.findUnique({ where: { livekitRoomName: roomName } })
      : null;
    if (event.egressInfo && (event.event === "egress_started" || event.event === "egress_updated" || event.event === "egress_ended")) {
      const info = event.egressInfo;
      const status = info.status === EgressStatus.EGRESS_ACTIVE
        ? "ACTIVE"
        : info.status === EgressStatus.EGRESS_COMPLETE
          ? "READY"
          : info.status === EgressStatus.EGRESS_FAILED || info.status === EgressStatus.EGRESS_ABORTED || info.status === EgressStatus.EGRESS_LIMIT_REACHED
            ? "FAILED"
            : info.status === EgressStatus.EGRESS_ENDING
              ? "PROCESSING"
              : "STARTING";
      const file = info.fileResults[0];
      await prisma.virtualClassRecording.updateMany({
        where: { egressId: info.egressId },
        data: {
          status,
          ...(info.startedAt ? { startedAt: new Date(Number(info.startedAt) / 1_000_000) } : {}),
          ...(info.endedAt ? { endedAt: new Date(Number(info.endedAt) / 1_000_000) } : {}),
          ...(file?.filename ? { storageKey: file.filename } : {}),
          ...(file?.duration ? { durationSeconds: Math.max(0, Math.round(Number(file.duration) / 1_000_000_000)) } : {}),
          technicalError: info.error ? info.error.slice(0, 1_000) : null,
        },
      });
    }
    if (virtualClass) {
      const at = event.createdAt ? new Date(Number(event.createdAt) * 1000) : new Date();
      if (event.event === "participant_joined" && event.participant) {
        await participantJoined(virtualClass, event.participant.identity, event.participant.sid, at);
      } else if ((event.event === "participant_left" || event.event === "participant_connection_aborted") && event.participant) {
        await participantLeft(virtualClass, event.participant.identity, event.participant.sid, at, event.event);
      } else if (event.event === "room_finished") {
        await roomFinished(virtualClass, at);
      }
    }
    await prisma.webhookEvent.update({ where: { id: eventId }, data: { status: "COMPLETED", processedAt: new Date() } });
    return NextResponse.json({ received: true });
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { status: "FAILED", lastError: safeError(error), processedAt: new Date() },
    }).catch(() => undefined);
    return NextResponse.json({ error: "Traitement LiveKit différé." }, { status: 500 });
  }
}

function safeJson(body: string): Prisma.InputJsonValue {
  try { return JSON.parse(body) as Prisma.InputJsonValue; } catch { return { invalidJson: true }; }
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1_000) : "Erreur inconnue";
}

async function participantJoined(
  virtualClass: { id: string; instructorId: string; trainingSessionId: string; status: string },
  identity: string,
  participantSid: string,
  at: Date,
) {
  const userId = userIdFromLiveKitIdentity(identity);
  if (!userId) return;
  const role = userId === virtualClass.instructorId ? "INSTRUCTOR" : await prisma.registration.findFirst({ where: { studentId: userId, sessionId: virtualClass.trainingSessionId, status: "ACTIVE" }, select: { id: true } }) ? "STUDENT" : "ADMIN";
  await prisma.$transaction(async (tx) => {
    const attendance = await tx.virtualClassAttendance.upsert({
      where: { virtualClassId_userId: { virtualClassId: virtualClass.id, userId } },
      create: { virtualClassId: virtualClass.id, userId, role, firstJoinedAt: at, lastActivityAt: at, connectionCount: 1, status: "PARTIAL" },
      update: { role, firstJoinedAt: { set: undefined }, lastActivityAt: at, connectionCount: { increment: 1 } },
    });
    if (!attendance.firstJoinedAt) await tx.virtualClassAttendance.update({ where: { id: attendance.id }, data: { firstJoinedAt: at, status: "PARTIAL" } });
    const stale = await tx.virtualClassConnectionPeriod.findMany({ where: { attendanceId: attendance.id, leftAt: null } });
    let recoveredSeconds = 0;
    for (const period of stale) {
      const durationSeconds = Math.max(0, Math.floor((at.getTime() - period.joinedAt.getTime()) / 1000));
      recoveredSeconds += durationSeconds;
      await tx.virtualClassConnectionPeriod.update({ where: { id: period.id }, data: { leftAt: at, durationSeconds, closeReason: "reconnected" } });
    }
    if (recoveredSeconds) await tx.virtualClassAttendance.update({ where: { id: attendance.id }, data: { totalSeconds: { increment: recoveredSeconds } } });
    await tx.virtualClassConnectionPeriod.create({ data: { attendanceId: attendance.id, participantSid, joinedAt: at } });
    if (role === "INSTRUCTOR" && virtualClass.status === "OPEN") {
      await tx.virtualClassSession.update({ where: { id: virtualClass.id }, data: { status: "LIVE", liveStartedAt: at } });
    }
  });
}

async function participantLeft(
  virtualClass: { id: string; durationMinutes: number },
  identity: string,
  participantSid: string,
  at: Date,
  reason: string,
) {
  const userId = userIdFromLiveKitIdentity(identity);
  if (!userId) return;
  await prisma.$transaction(async (tx) => {
    const attendance = await tx.virtualClassAttendance.findUnique({ where: { virtualClassId_userId: { virtualClassId: virtualClass.id, userId } } });
    if (!attendance) return;
    const period = await tx.virtualClassConnectionPeriod.findFirst({ where: { attendanceId: attendance.id, leftAt: null, ...(participantSid ? { participantSid } : {}) }, orderBy: { joinedAt: "desc" } });
    if (!period) return;
    const durationSeconds = Math.max(0, Math.floor((at.getTime() - period.joinedAt.getTime()) / 1000));
    const totalSeconds = attendance.totalSeconds + durationSeconds;
    await tx.virtualClassConnectionPeriod.update({ where: { id: period.id }, data: { leftAt: at, durationSeconds, closeReason: reason } });
    await tx.virtualClassAttendance.update({ where: { id: attendance.id }, data: { lastLeftAt: at, lastActivityAt: at, totalSeconds, status: attendanceStatusForDuration(totalSeconds, virtualClass.durationMinutes * 60) } });
  });
}

async function roomFinished(virtualClass: { id: string; durationMinutes: number; status: string }, at: Date) {
  await prisma.$transaction(async (tx) => {
    const attendances = await tx.virtualClassAttendance.findMany({ where: { virtualClassId: virtualClass.id }, include: { connectionPeriods: { where: { leftAt: null } } } });
    for (const attendance of attendances) {
      let added = 0;
      for (const period of attendance.connectionPeriods) {
        const durationSeconds = Math.max(0, Math.floor((at.getTime() - period.joinedAt.getTime()) / 1000));
        added += durationSeconds;
        await tx.virtualClassConnectionPeriod.update({ where: { id: period.id }, data: { leftAt: at, durationSeconds, closeReason: "room_finished" } });
      }
      const totalSeconds = attendance.totalSeconds + added;
      await tx.virtualClassAttendance.update({ where: { id: attendance.id }, data: { totalSeconds, lastLeftAt: added ? at : attendance.lastLeftAt, status: attendanceStatusForDuration(totalSeconds, virtualClass.durationMinutes * 60) } });
    }
    if (virtualClass.status === "OPEN" || virtualClass.status === "LIVE") {
      await tx.virtualClassSession.update({ where: { id: virtualClass.id }, data: { status: "ENDED", endedAt: at } });
    }
  });
}
