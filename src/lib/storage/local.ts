import "server-only";

// Backend de stockage LOCAL (disque) — utilisé en fallback quand Cloudflare R2
// n'est pas configuré (dev / single-host). Les fichiers sont écrits sous
// `public/uploads/` et servis statiquement à l'URL `/uploads/<key>`.
//
// L'upload se fait en deux temps, comme R2 :
//   1. `createLocalUpload()` renvoie une `uploadUrl` interne signée (HMAC) vers
//      `PUT /api/upload/blob` + l'`publicUrl` finale.
//   2. Le client PUT le fichier vers cette URL ; la route vérifie le token,
//      l'auth, puis écrit le blob sur disque.
//
// La signature HMAC empêche un client de choisir une `key` arbitraire (et donc
// d'écrire hors du préfixe qui lui est attribué) — la key est décidée côté
// serveur et signée.

import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { PresignedUploadResult } from "@/lib/storage/r2";
import {
  MAX_LOCAL_UPLOAD_BYTES,
  createLocalUploadToken,
} from "@/lib/storage/local-upload-token";

export { MAX_LOCAL_UPLOAD_BYTES, verifyUploadToken } from "@/lib/storage/local-upload-token";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

/** Résout un fichier déjà stocké sans créer de dossier (lecture publique). */
export function resolveLocalStoredFilePath(segments: string[]): string | null {
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("/") ||
        segment.includes("\\") ||
        segment.includes("\0"),
    )
  ) {
    return null;
  }

  const resolved = path.resolve(UPLOAD_ROOT, ...segments);
  return resolved.startsWith(UPLOAD_ROOT + path.sep) ? resolved : null;
}

/** Toujours disponible : on peut écrire sur le disque local. */
export function isLocalStorageEnabled(): boolean {
  return true;
}

/**
 * Génère une URL d'upload interne signée + l'URL publique finale.
 * Aucune requête réseau : tout est local. La `key` est générée et signée
 * côté serveur.
 */
export function createLocalUpload(params: {
  prefix: string;
  filename: string;
  expiresInSeconds?: number;
  maxSizeBytes?: number;
}): PresignedUploadResult {
  const safeName = params.filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  const key = `${params.prefix.replace(/^\/+|\/+$/g, "")}/${timestamp}-${rand}-${safeName}`;

  const expiresIn = params.expiresInSeconds ?? 600;
  const expiresAt = timestamp + expiresIn * 1000;
  const maxSizeBytes = params.maxSizeBytes ?? MAX_LOCAL_UPLOAD_BYTES;
  if (
    !Number.isSafeInteger(maxSizeBytes) ||
    maxSizeBytes <= 0 ||
    maxSizeBytes > MAX_LOCAL_UPLOAD_BYTES
  ) {
    throw new Error("Limite d'upload local invalide.");
  }
  const token = createLocalUploadToken(key, expiresAt, maxSizeBytes, "public");

  const uploadUrl = `/api/upload/blob?scope=public&key=${encodeURIComponent(key)}&exp=${expiresAt}&max=${maxSizeBytes}&token=${token}`;
  const publicUrl = `/uploads/${key}`;

  return { uploadUrl, publicUrl, key, expiresInSeconds: expiresIn };
}

/** Vérifie le token signé (HMAC + expiration), en temps constant. */
/**
 * Résout le chemin disque absolu pour une `key`, avec garde anti
 * path-traversal, et crée les dossiers parents. Lève si la key sort de
 * `public/uploads/`.
 */
export async function resolveLocalUploadPath(key: string): Promise<string> {
  const normalized = path.normalize(path.join(UPLOAD_ROOT, key));
  if (
    normalized !== UPLOAD_ROOT &&
    !normalized.startsWith(UPLOAD_ROOT + path.sep)
  ) {
    throw new Error("Clé d'upload invalide.");
  }
  await mkdir(path.dirname(normalized), { recursive: true });
  return normalized;
}
