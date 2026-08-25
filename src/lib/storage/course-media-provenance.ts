export interface CourseStorageConfig {
  r2AccountId?: string;
  r2Bucket?: string;
  r2PublicUrl?: string;
}

export type ManagedCourseObject =
  | { backend: "local"; key: string }
  | { backend: "r2"; key: string };

function validOwnedKey(key: string, ownerId: string): boolean {
  if (!ownerId || key.includes("\\") || key.includes("\0")) return false;
  let decoded: string;
  try { decoded = decodeURIComponent(key); } catch { return false; }
  if (decoded !== key || decoded.includes("..") || decoded.includes("/") && decoded.split("/").length !== 4) return false;
  const parts = decoded.split("/");
  const expected = parts[0] === "thumbnails" && parts[1] === "courses"
    ? ["thumbnails", "courses", ownerId]
    : parts[0] === "resources" && parts[1] === "lessons"
      ? ["resources", "lessons", ownerId]
      : null;
  if (!expected || parts.length !== 4 || parts.slice(0, 3).join("/") !== expected.join("/")) return false;
  return /^\d+-[a-z0-9]{8}-.+$/i.test(parts[3]);
}

function r2Key(url: URL, config: CourseStorageConfig): string | null {
  if (config.r2PublicUrl) {
    let base: URL;
    try { base = new URL(config.r2PublicUrl); } catch { return null; }
    if (url.origin !== base.origin) return null;
    const prefix = base.pathname.replace(/\/+$/, "");
    return url.pathname.startsWith(`${prefix}/`) ? url.pathname.slice(prefix.length + 1) : null;
  }
  if (!config.r2AccountId || !config.r2Bucket) return null;
  const prefix = `/${config.r2Bucket}/`;
  return url.hostname === `${config.r2AccountId}.r2.cloudflarestorage.com` && url.pathname.startsWith(prefix)
    ? url.pathname.slice(prefix.length)
    : null;
}

/** Ne reconnaît que les deux préfixes générés par l'app et appartenant au propriétaire du cours. */
export function managedCourseObjectFromUrl(
  value: string,
  ownerId: string,
  config: CourseStorageConfig,
): ManagedCourseObject | null {
  if (value.startsWith("/uploads/")) {
    const key = value.slice("/uploads/".length);
    return validOwnedKey(key, ownerId) ? { backend: "local", key } : null;
  }
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  const key = r2Key(url, config);
  return key && validOwnedKey(key, ownerId) ? { backend: "r2", key } : null;
}
