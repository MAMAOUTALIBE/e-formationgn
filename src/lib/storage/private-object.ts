import "server-only";

import {
  deletePrivateLocalObject,
  deletePrivateLocalPrefix,
  getPrivateLocalObjectBytes,
  getPrivateLocalObjectSize,
  putPrivateLocalObject,
} from "@/lib/storage/private-local";
import {
  deletePrivateR2Object,
  deletePrivateR2Prefix,
  getPrivateR2ObjectBytes,
  getPrivateR2ObjectSize,
  isR2Configured,
  putPrivateR2Object,
} from "@/lib/storage/r2";

export async function getPrivateObjectSize(key: string): Promise<number | null> {
  return isR2Configured()
    ? getPrivateR2ObjectSize(key)
    : getPrivateLocalObjectSize(key);
}

export async function getPrivateObjectBytes(
  key: string,
  maxSizeBytes: number,
): Promise<Buffer | null> {
  return isR2Configured()
    ? getPrivateR2ObjectBytes(key, maxSizeBytes)
    : getPrivateLocalObjectBytes(key, maxSizeBytes);
}

export async function deletePrivateObject(key: string): Promise<void> {
  return isR2Configured()
    ? deletePrivateR2Object(key)
    : deletePrivateLocalObject(key);
}

export async function putPrivateObject(
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  return isR2Configured()
    ? putPrivateR2Object(key, bytes, contentType)
    : putPrivateLocalObject(key, bytes);
}

export async function deletePrivateObjectPrefix(prefix: string): Promise<void> {
  return isR2Configured()
    ? deletePrivateR2Prefix(prefix)
    : deletePrivateLocalPrefix(prefix);
}
