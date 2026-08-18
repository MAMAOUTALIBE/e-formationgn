const VIDEO_EXTENSIONS = new Set([
  "3g2",
  "3gp",
  "asf",
  "avi",
  "divx",
  "dv",
  "f4v",
  "flv",
  "m2t",
  "m2ts",
  "m4v",
  "mkv",
  "mod",
  "mov",
  "mp4",
  "mpe",
  "mpeg",
  "mpg",
  "mts",
  "mxf",
  "ogm",
  "ogv",
  "qt",
  "rm",
  "rmvb",
  "tod",
  "ts",
  "vob",
  "webm",
  "wmv",
]);

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  "3g2": "video/3gpp2",
  "3gp": "video/3gpp",
  asf: "video/x-ms-asf",
  avi: "video/x-msvideo",
  f4v: "video/x-f4v",
  flv: "video/x-flv",
  m4v: "video/x-m4v",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  mp4: "video/mp4",
  mpe: "video/mpeg",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  m2ts: "video/mp2t",
  mts: "video/mp2t",
  ogv: "video/ogg",
  ts: "video/mp2t",
  vob: "video/dvd",
  webm: "video/webm",
  wmv: "video/x-ms-wmv",
};

function extensionOf(filename: string): string {
  const match = filename.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

/**
 * Certains navigateurs renvoient un type MIME vide ou application/octet-stream
 * pour MKV, MTS, MXF, etc. On accepte donc aussi les extensions vidéo usuelles.
 * L'hébergeur vidéo reste responsable de valider et d'encoder le contenu réel.
 */
export function isLikelyVideoFile(filename: string, contentType: string): boolean {
  return (
    contentType.trim().toLowerCase().startsWith("video/") ||
    VIDEO_EXTENSIONS.has(extensionOf(filename))
  );
}

/** Retourne un MIME vidéo stable même lorsque le navigateur n'en fournit pas. */
export function videoUploadContentType(filename: string, contentType: string): string {
  const normalized = contentType.trim().toLowerCase();
  if (normalized.startsWith("video/")) return normalized;
  return MIME_BY_EXTENSION[extensionOf(filename)] ?? "application/octet-stream";
}
