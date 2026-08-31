import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { AuthorizationError } from "@/lib/auth/authorization";
import { summarizeUserAgent } from "@/lib/domain/virtual-class";
import { checkRateLimit, clientKey } from "@/lib/rate-limit";
import {
  countLiveKitLearners,
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

    // L'accès a été accordé alors que la séance est encore `SCHEDULED` : c'est
    // la fenêtre d'ouverture anticipée. On matérialise l'ouverture pour que la
    // suite de la machine d'état reste valable — le webhook `participant_joined`
    // ne bascule en `LIVE` qu'au départ d'`OPEN`, et `room_finished` ne clôture
    // que `OPEN`/`LIVE`. `updateMany` filtré sur le statut rend l'écriture
    // idempotente : deux arrivées simultanées n'ouvrent la salle qu'une fois.
    if (access.virtualClass.status === "SCHEDULED") {
      await prisma.virtualClassSession.updateMany({
        where: { id: access.virtualClass.id, status: "SCHEDULED" },
        data: { status: "OPEN", openedAt: new Date() },
      });
    }
    // Le plafond ne s'applique qu'aux apprenants : un formateur ou un
    // administrateur ne consomme pas une place de formation, et devait pouvoir
    // entrer même sur une salle pleine — sans quoi personne ne peut animer.
    if (access.virtualClass.maxParticipants && access.roomRole === "STUDENT") {
      const learners = await countLiveKitLearners(access.virtualClass.livekitRoomName);
      const alreadyConnected = await prisma.virtualClassConnectionPeriod.findFirst({
        where: {
          attendance: { virtualClassId: id, userId: access.user.id },
          leftAt: null,
        },
        select: { id: true },
      });
      if (!alreadyConnected && learners >= access.virtualClass.maxParticipants) {
        return NextResponse.json({ error: "La capacité maximale de la salle est atteinte." }, { status: 409 });
      }
    }

    // Environnement relevé côté serveur depuis l'en-tête, jamais transmis par
    // le client : la route ne lit aucun corps de requête, et rien ici ne doit
    // pouvoir être choisi par l'appelant.
    const deviceInfo = {
      ...summarizeUserAgent(requestHeaders.get("user-agent")),
      seenAt: new Date().toISOString(),
    };
    await prisma.virtualClassAttendance.upsert({
      where: { virtualClassId_userId: { virtualClassId: id, userId: access.user.id } },
      create: { virtualClassId: id, userId: access.user.id, role: access.roomRole, deviceInfo },
      update: { role: access.roomRole, deviceInfo },
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
