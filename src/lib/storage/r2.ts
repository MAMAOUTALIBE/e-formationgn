import "server-only";

// Cloudflare R2 (S3-compatible) — wrapper pour générer des presigned URLs.
// Si les variables d'env R2 ne sont pas configurées, les fonctions lèvent
// une erreur claire pour aider le formateur à comprendre.

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let cachedClient: S3Client | null = null;

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string | null;
}

function getConfig(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET ?? "e-formationgn";
  const publicUrl = process.env.R2_PUBLIC_URL ?? null;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 non configuré. Renseignez R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY dans .env.",
    );
  }
  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl };
}

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  const cfg = getConfig();
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return cachedClient;
}

function getPrivateBucket(): string {
  const bucket = process.env.R2_PRIVATE_BUCKET;
  if (!bucket) {
    throw new Error(
      "R2_PRIVATE_BUCKET non configuré pour les fichiers pédagogiques privés.",
    );
  }
  return bucket;
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  );
}

export function isPrivateR2Configured(): boolean {
  return isR2Configured() && Boolean(process.env.R2_PRIVATE_BUCKET);
}

// Une URL publique (custom domain R2) est indispensable pour SERVIR les vidéos
// de leçon au lecteur — l'endpoint S3 signé brut n'est pas lisible publiquement.
// L'upload d'images peut s'en passer (servies via proxy/route), pas les vidéos.
export function isR2PublicUrlConfigured(): boolean {
  return Boolean(process.env.R2_PUBLIC_URL);
}

/** Supprime uniquement une clé déjà validée comme appartenant à notre bucket. */
export async function deleteR2Object(key: string): Promise<void> {
  const cfg = getConfig();
  await getClient().send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
}

export async function deletePrivateR2Object(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: getPrivateBucket(), Key: key }),
  );
}

export async function putPrivateR2Object(
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: getPrivateBucket(),
      Key: key,
      Body: bytes,
      ContentType: contentType,
      ContentLength: bytes.length,
      CacheControl: "private, max-age=31536000, immutable",
    }),
  );
}

export async function deletePrivateR2Prefix(prefix: string): Promise<void> {
  const bucket = getPrivateBucket();
  const normalizedPrefix = `${prefix.replace(/\/+$/, "")}/`;
  let continuationToken: string | undefined;
  let pageCount = 0;

  do {
    if (pageCount >= 10) {
      throw new Error("Trop d'objets privés à nettoyer pour ce préfixe.");
    }
    const listed = await getClient().send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: normalizedPrefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1_000,
      }),
    );
    const objects = (listed.Contents ?? [])
      .map((item) => item.Key)
      .filter((key): key is string => Boolean(key))
      .map((Key) => ({ Key }));
    if (objects.length > 0) {
      const deleted = await getClient().send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: objects, Quiet: true },
        }),
      );
      if ((deleted.Errors?.length ?? 0) > 0) {
        throw new Error("Certains objets privés n'ont pas pu être supprimés.");
      }
    }
    continuationToken = listed.IsTruncated
      ? listed.NextContinuationToken
      : undefined;
    pageCount += 1;
  } while (continuationToken);
}

export async function getR2Object(key: string, range?: string | null) {
  const cfg = getConfig();
  return getClient().send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key, ...(range ? { Range: range } : {}) }));
}

export async function getPrivateR2ObjectBytes(
  key: string,
  maxSizeBytes: number,
): Promise<Buffer | null> {
  try {
    const result = await getClient().send(
      new GetObjectCommand({ Bucket: getPrivateBucket(), Key: key }),
    );
    if (!result.Body) return null;

    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      const bytes = Buffer.from(chunk);
      total += bytes.length;
      if (total > maxSizeBytes) return null;
      chunks.push(bytes);
    }
    return Buffer.concat(chunks, total);
  } catch {
    return null;
  }
}

export async function getR2ObjectSize(key: string): Promise<number | null> {
  const cfg = getConfig();
  try {
    const result = await getClient().send(
      new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }),
    );
    return typeof result.ContentLength === "number" ? result.ContentLength : null;
  } catch {
    return null;
  }
}

export async function getPrivateR2ObjectSize(key: string): Promise<number | null> {
  try {
    const result = await getClient().send(
      new HeadObjectCommand({ Bucket: getPrivateBucket(), Key: key }),
    );
    return typeof result.ContentLength === "number" ? result.ContentLength : null;
  } catch {
    return null;
  }
}

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresInSeconds: number;
}

export type PrivatePresignedUploadResult = Omit<PresignedUploadResult, "publicUrl">;

export async function createPrivatePresignedUpload(params: {
  prefix: string;
  filename: string;
  contentType: string;
  maxSizeBytes: number;
  expiresInSeconds?: number;
}): Promise<PrivatePresignedUploadResult> {
  const safeName = params.filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  const key = `${params.prefix.replace(/^\/+|\/+$/g, "")}/${timestamp}-${rand}-${safeName}`;
  const expiresIn = params.expiresInSeconds ?? 60;
  const command = new PutObjectCommand({
    Bucket: getPrivateBucket(),
    Key: key,
    ContentType: params.contentType,
    ContentLength: params.maxSizeBytes,
  });
  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn,
  });
  return { uploadUrl, key, expiresInSeconds: expiresIn };
}

/**
 * Génère une URL signée d'upload PUT vers R2 + l'URL publique attendue.
 * Le client peut ensuite faire un PUT direct vers `uploadUrl` avec le fichier
 * en body (sans transit par notre serveur).
 */
export async function createPresignedUpload(params: {
  /** Préfixe sous lequel ranger le fichier (ex: "thumbnails/courses"). */
  prefix: string;
  /** Nom de fichier d'origine (utilisé pour deviner l'extension). */
  filename: string;
  /** MIME type — sécurise contre l'upload de binaires arbitraires. */
  contentType: string;
  /** Taille max acceptée en octets (refusé si dépassé). */
  maxSizeBytes?: number;
  /** Durée de validité de l'URL signée (par défaut 60 s). */
  expiresInSeconds?: number;
}): Promise<PresignedUploadResult> {
  const cfg = getConfig();
  const client = getClient();

  // Sanitize filename → on garde uniquement [a-zA-Z0-9._-], collision-safe via timestamp + random
  const safeName = params.filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  const key = `${params.prefix.replace(/^\/+|\/+$/g, "")}/${timestamp}-${rand}-${safeName}`;

  const expiresIn = params.expiresInSeconds ?? 60;

  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    ContentType: params.contentType,
    ContentLength: params.maxSizeBytes,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  // URL publique — utilise R2_PUBLIC_URL si configurée (custom domain), sinon
  // l'URL S3-compatible. Le formateur doit configurer un domaine public R2.
  const publicUrl = cfg.publicUrl
    ? `${cfg.publicUrl.replace(/\/+$/, "")}/${key}`
    : `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${key}`;

  return { uploadUrl, publicUrl, key, expiresInSeconds: expiresIn };
}
