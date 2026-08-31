import "server-only";

import {
  AccessToken,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  S3Upload,
  TrackSource,
  WebhookReceiver,
  type VideoGrant,
} from "livekit-server-sdk";
import { virtualClassPublishingPolicy } from "@/lib/domain/virtual-class";

export type LiveKitParticipantRole = "ADMIN" | "INSTRUCTOR" | "STUDENT";

export interface LiveKitServerConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
  webhookSecret: string;
}

export class ReplayStorageConfigurationError extends Error {
  constructor() {
    super("Le stockage privé des replays n’est pas configuré (variables R2 absentes).");
    this.name = "ReplayStorageConfigurationError";
  }
}

export class LiveKitConfigurationError extends Error {
  constructor() {
    super("Le service de classe virtuelle n’est pas encore configuré.");
    this.name = "LiveKitConfigurationError";
  }
}

export function isLiveKitConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_URL &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET &&
      process.env.LIVEKIT_WEBHOOK_SECRET,
  );
}

export function getLiveKitConfig(): LiveKitServerConfig {
  if (!isLiveKitConfigured()) throw new LiveKitConfigurationError();
  return {
    url: process.env.LIVEKIT_URL!,
    apiKey: process.env.LIVEKIT_API_KEY!,
    apiSecret: process.env.LIVEKIT_API_SECRET!,
    webhookSecret: process.env.LIVEKIT_WEBHOOK_SECRET!,
  };
}

function liveKitHttpUrl(url: string): string {
  return url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

export function liveKitIdentity(userId: string): string {
  return `aiduca:${userId}`;
}

export function userIdFromLiveKitIdentity(identity: string): string | null {
  return identity.startsWith("aiduca:") ? identity.slice("aiduca:".length) || null : null;
}

export async function createVirtualClassToken(input: {
  roomName: string;
  classId: string;
  userId: string;
  displayName: string;
  role: LiveKitParticipantRole;
}): Promise<{ serverUrl: string; token: string; expiresInSeconds: number }> {
  const config = getLiveKitConfig();
  const expiresInSeconds = 10 * 60;
  const policy = virtualClassPublishingPolicy(input.role);
  const sourceMap = {
    CAMERA: TrackSource.CAMERA,
    MICROPHONE: TrackSource.MICROPHONE,
    SCREEN_SHARE: TrackSource.SCREEN_SHARE,
    SCREEN_SHARE_AUDIO: TrackSource.SCREEN_SHARE_AUDIO,
  } as const;
  const grant: VideoGrant = {
    room: input.roomName,
    roomJoin: true,
    canSubscribe: policy.canSubscribe,
    canPublish: policy.canPublish,
    canPublishData: policy.canPublishData,
    canUpdateOwnMetadata: true,
    canPublishSources: policy.sources.map((source) => sourceMap[source]),
  };
  const accessToken = new AccessToken(config.apiKey, config.apiSecret, {
    identity: liveKitIdentity(input.userId),
    name: input.displayName,
    ttl: expiresInSeconds,
    metadata: JSON.stringify({ classId: input.classId, role: input.role }),
    attributes: { role: input.role, handRaised: "false" },
  });
  accessToken.addGrant(grant);
  return {
    serverUrl: config.url,
    token: await accessToken.toJwt(),
    expiresInSeconds,
  };
}

let roomClient: RoomServiceClient | null = null;
let egressClient: EgressClient | null = null;
export function getLiveKitRoomClient(): RoomServiceClient {
  if (roomClient) return roomClient;
  const config = getLiveKitConfig();
  roomClient = new RoomServiceClient(
    liveKitHttpUrl(config.url),
    config.apiKey,
    config.apiSecret,
  );
  return roomClient;
}

/** Places à réserver dans LiveKit en plus des apprenants (formateur + admin). */
export const LIVEKIT_MODERATOR_HEADROOM = 2;

export async function ensureLiveKitRoom(input: {
  name: string;
  maxParticipants: number | null;
  metadata: Record<string, string>;
}): Promise<void> {
  const client = getLiveKitRoomClient();
  const existing = await client.listRooms([input.name]);
  const current = existing[0];
  if (current) {
    // LiveKit n'expose aucune mise à jour de `maxParticipants` : la seule
    // façon de refléter une capacité modifiée après coup est de recréer la
    // salle. On ne le fait QUE si elle est vide — jamais au milieu d'un cours,
    // ce qui déconnecterait tout le monde. Une salle occupée garde son ancienne
    // limite jusqu'à son expiration ; le contrôle applicatif, lui, lit la base
    // à jour et reste donc exact dans l'intervalle.
    const desired = input.maxParticipants
      ? input.maxParticipants + LIVEKIT_MODERATOR_HEADROOM
      : 0;
    if (current.numParticipants === 0 && current.maxParticipants !== desired) {
      await client.deleteRoom(input.name);
    } else {
      return;
    }
  }
  await client.createRoom({
    name: input.name,
    emptyTimeout: 10 * 60,
    departureTimeout: 30,
    // Marge pour les modérateurs : la limite saisie compte des apprenants, or
    // celle de LiveKit compte tout le monde. Sans cette réserve, le formateur
    // arrivé après les apprenants se faisait refuser par sa propre salle.
    maxParticipants: input.maxParticipants
      ? input.maxParticipants + LIVEKIT_MODERATOR_HEADROOM
      : 0,
    metadata: JSON.stringify(input.metadata),
  });
}

/**
 * Nombre d'APPRENANTS connectés à la salle.
 *
 * Les modérateurs sont exclus : « Participants maximum » est un nombre de
 * places pour la formation. Compter le formateur revenait à en retirer une
 * silencieusement — sur une salle à 2 places, le second apprenant se voyait
 * refuser l'entrée alors que l'écran annonçait « 2 places ».
 *
 * Le rôle est relu dans les métadonnées que NOUS avons signées dans le jeton :
 * un participant ne peut pas se déclarer modérateur pour échapper au décompte.
 * Une métadonnée absente ou illisible compte comme un apprenant — c'est le
 * sens le plus strict.
 */
export async function countLiveKitLearners(roomName: string): Promise<number> {
  const participants = await getLiveKitRoomClient().listParticipants(roomName);
  return participants.filter((participant) => {
    try {
      const metadata = JSON.parse(participant.metadata || "{}") as { role?: string };
      return metadata.role !== "ADMIN" && metadata.role !== "INSTRUCTOR";
    } catch {
      return true;
    }
  }).length;
}

export async function updateStudentPublishing(input: {
  roomName: string;
  userId: string;
  allowMicrophone: boolean;
  allowCamera?: boolean;
}): Promise<void> {
  const sources = [
    ...(input.allowMicrophone ? [TrackSource.MICROPHONE] : []),
    ...(input.allowCamera ? [TrackSource.CAMERA] : []),
  ];
  await getLiveKitRoomClient().updateParticipant(
    input.roomName,
    liveKitIdentity(input.userId),
    {
      permission: {
        canSubscribe: true,
        canPublish: sources.length > 0,
        canPublishData: true,
        canUpdateMetadata: true,
        canPublishSources: sources,
      },
    },
  );
}

export async function removeLiveKitParticipant(roomName: string, userId: string): Promise<void> {
  await getLiveKitRoomClient().removeParticipant(roomName, liveKitIdentity(userId));
}

export async function closeLiveKitRoom(roomName: string): Promise<void> {
  await getLiveKitRoomClient().deleteRoom(roomName);
}

function getLiveKitEgressClient(): EgressClient {
  if (egressClient) return egressClient;
  const config = getLiveKitConfig();
  egressClient = new EgressClient(liveKitHttpUrl(config.url), config.apiKey, config.apiSecret);
  return egressClient;
}

function getEgressStorage() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET ?? "e-formationgn";
  if (!accountId || !accessKey || !secret) throw new ReplayStorageConfigurationError();
  return { accountId, accessKey, secret, bucket };
}

export async function startRoomRecording(input: { roomName: string; virtualClassId: string }) {
  const storage = getEgressStorage();
  const key = `replays/virtual-classes/${input.virtualClassId}/${Date.now()}.mp4`;
  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: key,
    output: {
      case: "s3",
      value: new S3Upload({
        accessKey: storage.accessKey,
        secret: storage.secret,
        region: "auto",
        endpoint: `https://${storage.accountId}.r2.cloudflarestorage.com`,
        bucket: storage.bucket,
        forcePathStyle: true,
      }),
    },
  });
  const info = await getLiveKitEgressClient().startRoomCompositeEgress(input.roomName, output, { layout: "speaker" });
  return { egressId: info.egressId, storageKey: key };
}

export async function stopRoomRecording(egressId: string) {
  return getLiveKitEgressClient().stopEgress(egressId);
}

export function getLiveKitWebhookReceiver(): WebhookReceiver {
  const config = getLiveKitConfig();
  // LiveKit signe le JWT de webhook avec la clé associée à l'issuer API.
  // Aiduca permet une clé dédiée via LIVEKIT_WEBHOOK_SECRET, configurée dans
  // le projet LiveKit pour cette destination.
  return new WebhookReceiver(config.apiKey, config.webhookSecret);
}
