import "server-only";

import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import type { PrivatePresignedUploadResult } from "@/lib/storage/r2";
import {
  MAX_LOCAL_UPLOAD_BYTES,
  createLocalUploadToken,
} from "@/lib/storage/local-upload-token";
import { resolvePrivateStoredFilePath } from "@/lib/storage/private-local-path";

export function createPrivateLocalUpload(params: {
  prefix: string;
  filename: string;
  expiresInSeconds?: number;
  maxSizeBytes?: number;
}): PrivatePresignedUploadResult {
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
    throw new Error("Limite d'upload privé invalide.");
  }

  const token = createLocalUploadToken(
    key,
    expiresAt,
    maxSizeBytes,
    "private",
  );
  const uploadUrl = `/api/upload/blob?scope=private&key=${encodeURIComponent(key)}&exp=${expiresAt}&max=${maxSizeBytes}&token=${token}`;

  return { uploadUrl, key, expiresInSeconds: expiresIn };
}

export async function resolvePrivateLocalUploadPath(key: string): Promise<string> {
  const resolved = resolvePrivateStoredFilePath(key);
  if (!resolved) throw new Error("Clé d'upload privé invalide.");
  await mkdir(path.dirname(resolved), { recursive: true });
  return resolved;
}

export async function getPrivateLocalObjectSize(key: string): Promise<number | null> {
  const filePath = resolvePrivateStoredFilePath(key);
  if (!filePath) return null;
  try {
    const metadata = await stat(filePath);
    return metadata.isFile() ? metadata.size : null;
  } catch {
    return null;
  }
}

export async function getPrivateLocalObjectBytes(
  key: string,
  maxSizeBytes: number,
): Promise<Buffer | null> {
  const filePath = resolvePrivateStoredFilePath(key);
  if (!filePath) return null;
  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile() || metadata.size > maxSizeBytes) return null;
    const bytes = await readFile(filePath);
    return bytes.length <= maxSizeBytes ? bytes : null;
  } catch {
    return null;
  }
}

export async function deletePrivateLocalObject(key: string): Promise<void> {
  const filePath = resolvePrivateStoredFilePath(key);
  if (!filePath) return;
  await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export async function putPrivateLocalObject(
  key: string,
  bytes: Buffer,
): Promise<void> {
  const destination = await resolvePrivateLocalUploadPath(key);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
    await rename(temporary, destination);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

export async function deletePrivateLocalPrefix(prefix: string): Promise<void> {
  const guard = resolvePrivateStoredFilePath(
    `${prefix.replace(/\/+$/, "")}/.prefix-guard`,
  );
  if (!guard) throw new Error("Préfixe privé invalide.");
  await rm(path.dirname(guard), { recursive: true, force: true });
}
