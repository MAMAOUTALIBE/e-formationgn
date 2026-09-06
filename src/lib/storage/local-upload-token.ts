import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_LOCAL_UPLOAD_BYTES = 1024 * 1024 * 1024;
export type LocalUploadScope = "public" | "private";

function secret(): string {
  return process.env.NEXTAUTH_SECRET ?? "dev-insecure-upload-secret";
}

export function createLocalUploadToken(
  key: string,
  expiresAt: number,
  maxSizeBytes: number,
  scope: LocalUploadScope,
): string {
  return createHmac("sha256", secret())
    .update(`${scope}:${key}:${expiresAt}:${maxSizeBytes}`)
    .digest("hex");
}

export function verifyUploadToken(
  key: string,
  expiresAt: number,
  token: string,
  maxSizeBytes: number,
  scope: LocalUploadScope,
): boolean {
  if (
    !Number.isFinite(expiresAt) ||
    expiresAt < Date.now() ||
    !Number.isSafeInteger(maxSizeBytes) ||
    maxSizeBytes <= 0 ||
    maxSizeBytes > MAX_LOCAL_UPLOAD_BYTES
  ) {
    return false;
  }
  const expected = createLocalUploadToken(key, expiresAt, maxSizeBytes, scope);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
