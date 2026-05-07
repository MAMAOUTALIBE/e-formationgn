// Wrapper @mux/mux-node — instancie un client paresseusement et expose les
// méthodes utiles côté serveur. On lance une erreur explicite si les
// identifiants Mux sont absents (au lieu d'une erreur opaque depuis le SDK).
//
// Notes opérationnelles :
// - Mux propose des « direct uploads » : on demande une URL signée, le
//   navigateur du formateur PUT directement le fichier vers Mux. Le serveur
//   ne sert que d'orchestrateur — pas de bande passante consommée chez nous.
// - L'asset est traité côté Mux ; on est notifié via webhook
//   `video.asset.ready` (cf. /api/webhooks/mux). En complément on permet
//   un polling explicite via `confirmMuxUpload`.

import Mux from "@mux/mux-node";

let cachedClient: Mux | null = null;

export function getMuxClient(): Mux {
  if (cachedClient) return cachedClient;

  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    throw new Error(
      "Mux non configuré. Renseignez MUX_TOKEN_ID et MUX_TOKEN_SECRET dans .env.",
    );
  }

  cachedClient = new Mux({
    tokenId,
    tokenSecret,
    webhookSecret: process.env.MUX_WEBHOOK_SECRET,
  });
  return cachedClient;
}

export function isMuxConfigured(): boolean {
  return Boolean(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);
}

export interface CreatedDirectUpload {
  uploadId: string;
  url: string;
}

export async function createDirectUpload(
  corsOrigin: string,
): Promise<CreatedDirectUpload> {
  const mux = getMuxClient();
  const upload = await mux.video.uploads.create({
    cors_origin: corsOrigin,
    new_asset_settings: {
      playback_policies: ["public"],
      // Sous-titres et transcriptions automatiques — utile pour
      // l'accessibilité et le SEO.
      // (Optionnels selon le tarif Mux ; on garde simple en Phase 3.)
    },
    test: process.env.NODE_ENV !== "production",
  });

  if (!upload.url) {
    throw new Error("Mux n'a pas renvoyé d'URL d'upload.");
  }
  return { uploadId: upload.id, url: upload.url };
}

export interface FetchedUpload {
  uploadId: string;
  status: string;
  assetId: string | null;
}

export async function getUpload(uploadId: string): Promise<FetchedUpload> {
  const mux = getMuxClient();
  const upload = await mux.video.uploads.retrieve(uploadId);
  return {
    uploadId: upload.id,
    status: upload.status ?? "unknown",
    assetId: upload.asset_id ?? null,
  };
}

export interface FetchedAsset {
  assetId: string;
  status: string;
  durationSeconds: number;
  playbackId: string | null;
}

export async function getAsset(assetId: string): Promise<FetchedAsset> {
  const mux = getMuxClient();
  const asset = await mux.video.assets.retrieve(assetId);
  const playback = asset.playback_ids?.[0];
  return {
    assetId: asset.id,
    status: asset.status ?? "unknown",
    durationSeconds: asset.duration ? Math.round(asset.duration) : 0,
    playbackId: playback?.id ?? null,
  };
}

export async function deleteAsset(assetId: string): Promise<void> {
  const mux = getMuxClient();
  await mux.video.assets.delete(assetId);
}
