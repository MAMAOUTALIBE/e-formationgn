import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { AuthorizationError } from "@/lib/auth/authorization";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import {
  countLiveKitParticipants,
  createVirtualClassToken,
  ensureLiveKitRoom,
  liveKitIdentity,
  LiveKitConfigurationError,
} from "@/lib/livekit/server";
import { prisma } from "@/lib/prisma";
import {
  requireVirtualClassAccess,
  VirtualClassAccessError,
} from "@/server/services/virtual-class-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const access = await requireVirtualClassAccess(id);
    const requestHeaders = await headers();
    const rate = await checkRateLimit({
      key: `${clientKey(requestHeaders, "virtual-class-token")}:${access.user.id}`,
      windowMs: 60_000,
      max: 12,
    });
    if (!rate.ok) {
      return NextResponse.json({ error: "Trop de demandes. Réessayez dans un instant." }, { status: 429 });
    }

    await ensureLiveKitRoom({
      name: access.virtualClass.livekitRoomName,
      maxParticipants: access.virtualClass.maxParticipants,
      metadata: { virtualClassId: access.virtualClass.id },
    });
    if (access.virtualClass.maxParticipants) {
      const participants = await countLiveKitParticipants(access.virtualClass.livekitRoomName);
      const alreadyConnected = await prisma.virtualClassConnectionPeriod.findFirst({
        where: {
          attendance: { virtualClassId: id, userId: access.user.id },
          leftAt: null,
        },
        select: { id: true },
      });
      if (!alreadyConnected && participants >= access.virtualClass.maxParticipants) {
        return NextResponse.json({ error: "La capacité maximale de la salle est atteinte." }, { status: 409 });
      }
    }

    await prisma.virtualClassAttendance.upsert({
      where: { virtualClassId_userId: { virtualClassId: id, userId: access.user.id } },
      create: { virtualClassId: id, userId: access.user.id, role: access.roomRole },
      update: { role: access.roomRole },
    });
    const credentials = await createVirtualClassToken({
      roomName: access.virtualClass.livekitRoomName,
      classId: access.virtualClass.id,
      userId: access.user.id,
      displayName: access.displayName,
      role: access.roomRole,
    });
    return NextResponse.json({
      ...credentials,
      participantIdentity: liveKitIdentity(access.user.id),
      role: access.roomRole,
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "UNAUTHENTICATED" ? 401 : error.code === "NOT_FOUND" ? 404 : 403 },
      );
    }
    if (error instanceof LiveKitConfigurationError) {
      return NextResponse.json({ error: error.message, code: "LIVEKIT_NOT_CONFIGURED" }, { status: 503 });
    }
    if (error instanceof VirtualClassAccessError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "NOT_OPEN" ? 409 : 403;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ error: "La connexion à la salle a échoué." }, { status: 500 });
  }
}
