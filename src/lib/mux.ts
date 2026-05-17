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

import { createHmac } from "node:crypto";

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

// Si MUX_SIGNED_PLAYBACK=1 + clés de signature présentes, les NOUVEAUX uploads
// utilisent une playback_policy "signed" → le playbackId seul ne suffit plus
// à lire la vidéo, il faut aussi un JWT signé par notre serveur (expirable).
// Sans ça (défaut), les playbackIds restent publics — usage interne ou démo.
export function isMuxSignedPlaybackEnabled(): boolean {
  return (
    process.env.MUX_SIGNED_PLAYBACK === "1" &&
    Boolean(
      process.env.MUX_SIGNING_KEY_ID && process.env.MUX_SIGNING_KEY_PRIVATE,
    )
  );
}

export async function createDirectUpload(
  corsOrigin: string,
): Promise<CreatedDirectUpload> {
  const mux = getMuxClient();
  const upload = await mux.video.uploads.create({
    cors_origin: corsOrigin,
    new_asset_settings: {
      playback_policies: isMuxSignedPlaybackEnabled() ? ["signed"] : ["public"],
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

// ---------------------------------------------------------------------------
// Signed playback tokens (JWT HS256)
// ---------------------------------------------------------------------------
//
// Mux attend un JWT signé avec la clé privée associée à `MUX_SIGNING_KEY_ID`.
// Header `{"alg":"RS256","kid":...}` historiquement, mais Mux accepte aussi
// HS256 si la clé est partagée. Pour rester compatible avec tous les types de
// clés (RS256 + HS256), on délègue idéalement à `@mux/mux-node` côté serveur,
// mais le SDK n'expose pas un helper direct → on construit le JWT à la main
// avec RS256 (format standard). La clé privée doit être en PEM PKCS#8.
//
// Si on est en mode "public" (legacy ou MUX_SIGNED_PLAYBACK désactivé), on
// retourne null et le player utilise juste le playbackId sans token.

import { createSign } from "node:crypto";

export interface SignPlaybackOptions {
  playbackId: string;
  /** Durée de validité du token. Court = sécurité, mais à ré-émettre. */
  expiresInSeconds?: number;
  /** "video" pour la lecture, "thumbnail" pour les preview images, "storyboard" pour les chapitres. */
  audience?: "v" | "t" | "s" | "g";
  /** ID utilisateur pour audit (optionnel, devient le `sub` du JWT). */
  subject?: string;
}

export function signMuxPlaybackToken(opts: SignPlaybackOptions): string | null {
  if (!isMuxSignedPlaybackEnabled()) return null;

  const keyId = process.env.MUX_SIGNING_KEY_ID!;
  const privateKeyBase64 = process.env.MUX_SIGNING_KEY_PRIVATE!;
  // Mux fournit la clé en base64. On décode pour obtenir le PEM PKCS#8.
  const privateKeyPem = Buffer.from(privateKeyBase64, "base64").toString("utf8");

  const now = Math.floor(Date.now() / 1000);
  const exp = now + (opts.expiresInSeconds ?? 60 * 60); // 1h par défaut

  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: keyId,
  };
  const payload: Record<string, string | number> = {
    sub: opts.playbackId,
    aud: opts.audience ?? "v",
    exp,
    iat: now,
    kid: keyId,
  };
  if (opts.subject) payload["customer"] = opts.subject;

  const segments = [base64UrlJson(header), base64UrlJson(payload)];
  const signingInput = segments.join(".");

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(privateKeyPem).toString("base64url");

  return `${signingInput}.${signature}`;
}

function base64UrlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// Helper de compatibilité utilisé par les pages lesson : retourne juste le
// HMAC stub si une clé symétrique est définie (alternative simple — RS256
// reste la convention Mux). Inutilisé par défaut, gardé pour debug futur.
export function hmacPlaybackToken(playbackId: string, secret: string): string {
  return createHmac("sha256", secret).update(playbackId).digest("base64url");
}

