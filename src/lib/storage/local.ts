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

import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { PresignedUploadResult } from "@/lib/storage/r2";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

function secret(): string {
  // NEXTAUTH_SECRET est toujours posé (auth obligatoire) ; fallback dev.
  return process.env.NEXTAUTH_SECRET ?? "dev-insecure-upload-secret";
}

function sign(key: string, expiresAt: number): string {
  return createHmac("sha256", secret())
    .update(`${key}:${expiresAt}`)
    .digest("hex");
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
}): PresignedUploadResult {
  const safeName = params.filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  const key = `${params.prefix.replace(/^\/+|\/+$/g, "")}/${timestamp}-${rand}-${safeName}`;

  const expiresIn = params.expiresInSeconds ?? 600;
  const expiresAt = timestamp + expiresIn * 1000;
  const token = sign(key, expiresAt);

  const uploadUrl = `/api/upload/blob?key=${encodeURIComponent(key)}&exp=${expiresAt}&token=${token}`;
  const publicUrl = `/uploads/${key}`;

  return { uploadUrl, publicUrl, key, expiresInSeconds: expiresIn };
}

/** Vérifie le token signé (HMAC + expiration), en temps constant. */
export function verifyUploadToken(
  key: string,
  expiresAt: number,
  token: string,
): boolean {
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = sign(key, expiresAt);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

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
