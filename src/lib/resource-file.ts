// Fichiers joints d'une leçon (« ressources téléchargeables »).
//
// Isomorphe volontairement — comme `video-file.ts` : le composant client s'en
// sert pour refuser un fichier avant de solliciter le serveur, la route de
// presign pour refaire le même contrôle côté serveur. Un seul jeu de règles,
// donc pas de divergence entre ce que l'interface promet et ce que l'API
// accepte.
//
// Les vidéos sont admises SANS restriction de format ni de taille : la liste
// blanche d'extensions ci-dessous ne concerne que les documents. Un format
// vidéo exotique (MXF, RMVB, TOD, conteneur inconnu que le navigateur annonce
// en `video/*`) passe donc, là où un `.docx` mal nommé est refusé. Seules les
// extensions exécutables restent bloquées, y compris pour un fichier qui se
// déclarerait vidéo — c'est la seule exception, et elle ne porte pas sur un
// format vidéo réel.

import { isLikelyVideoFile, videoUploadContentType } from "@/lib/video-file";

/**
 * Plafond applicatif d'un DOCUMENT joint (support de cours, diaporama…).
 * Les vidéos n'en ont pas : cf. `resourceSizeLimitFor`.
 */
export const MAX_RESOURCE_BYTES = 100 * 1024 * 1024; // 100 Mio

/**
 * Extensions refusées quoi qu'annonce le navigateur.
 *
 * Ces fichiers sont servis depuis l'origine de la plateforme (`/uploads/…`)
 * ou du domaine de stockage : un HTML ou un SVG s'y exécuterait comme du code
 * de la page. Les exécutables et scripts n'ont, eux, aucune raison d'être un
 * support de cours.
 */
const DENIED_EXTENSIONS =
  /\.(svgz?|x?html?|jsx?|mjs|cjs|php\d?|phtml|phar|exe|msi|bat|cmd|com|scr|cpl|dll|sh|bash|zsh|ps1|vbs|wsf|jar|apk|app|dmg|pkg|deb|rpm)$/i;

const DENIED_TYPES = new Set([
  "image/svg+xml",
  "image/svg",
  "text/html",
  "application/xhtml+xml",
  "text/javascript",
  "application/javascript",
  "application/x-msdownload",
  "application/x-httpd-php",
]);

/**
 * Extensions acceptées. On raisonne d'abord par extension : les navigateurs
 * renvoient trop souvent `application/octet-stream` (ou rien) pour les
 * formats bureautiques, un filtrage MIME seul rejetterait des fichiers
 * parfaitement légitimes.
 */
const ALLOWED_EXTENSIONS = new Set([
  // Documents
  "pdf", "doc", "docx", "odt", "rtf", "txt", "md", "epub",
  // Tableurs
  "xls", "xlsx", "ods", "csv", "tsv",
  // Présentations
  "ppt", "pptx", "odp",
  // Images
  "jpg", "jpeg", "png", "webp", "avif", "gif", "bmp", "tif", "tiff", "heic",
  // Archives
  "zip", "rar", "7z", "tar", "gz",
  // Audio
  "mp3", "wav", "m4a", "aac", "ogg", "oga", "flac",
]);

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  rtf: "application/rtf",
  txt: "text/plain",
  md: "text/markdown",
  epub: "application/epub+zip",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odp: "application/vnd.oasis.opendocument.presentation",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
};

export function resourceExtensionOf(filename: string): string {
  const match = filename.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

/** Le fichier est-il une vidéo, quel qu'en soit le conteneur ? */
export function isVideoResource(filename: string, contentType: string): boolean {
  return isLikelyVideoFile(filename, contentType);
}

/**
 * Le fichier est-il un support de cours acceptable ?
 *
 * Le refus des extensions exécutables reste en tête, avant toute autre
 * considération : sans lui, il suffirait d'annoncer `video/mp4` pour déposer
 * un `.html` qui s'exécuterait ensuite dans l'origine de la plateforme.
 * Passé ce garde-fou, toute vidéo est acceptée ; les autres fichiers doivent
 * figurer dans la liste blanche des formats bureautiques.
 */
export function isAllowedResourceFile(filename: string, contentType: string): boolean {
  const normalizedType = contentType.trim().toLowerCase();
  if (DENIED_TYPES.has(normalizedType)) return false;
  if (DENIED_EXTENSIONS.test(filename.trim())) return false;
  if (isVideoResource(filename, contentType)) return true;
  return ALLOWED_EXTENSIONS.has(resourceExtensionOf(filename));
}

/**
 * Plafond de taille applicable à ce fichier, ou `null` quand il n'y en a pas.
 *
 * Les vidéos ne sont pas plafonnées côté application — même règle que la
 * vignette de cours. Le stockage garde ses propres limites : R2 les siennes,
 * et la route `/api/upload/blob` 1 Go quand le stockage objet n'est pas
 * configuré.
 */
export function resourceSizeLimitFor(
  filename: string,
  contentType: string,
): number | null {
  return isVideoResource(filename, contentType) ? null : MAX_RESOURCE_BYTES;
}

/** MIME stable, même quand le navigateur n'en fournit aucun. */
export function resourceUploadContentType(filename: string, contentType: string): string {
  // La vidéo a sa propre table : les navigateurs renvoient très souvent un
  // type vide pour MKV, MTS ou MXF.
  if (isVideoResource(filename, contentType)) {
    return videoUploadContentType(filename, contentType);
  }
  const byExtension = MIME_BY_EXTENSION[resourceExtensionOf(filename)];
  if (byExtension) return byExtension;
  const normalized = contentType.trim().toLowerCase();
  return normalized && !DENIED_TYPES.has(normalized)
    ? normalized
    : "application/octet-stream";
}

/**
 * Attribut `accept` d'un `<input type="file">`.
 *
 * `video/*` plutôt qu'une liste d'extensions vidéo : le sélecteur de fichiers
 * doit laisser passer les conteneurs que nous ne nommons pas explicitement,
 * puisque la validation, elle, les accepte.
 */
export const RESOURCE_ACCEPT_ATTRIBUTE = [
  "video/*",
  ...[...ALLOWED_EXTENSIONS].map((extension) => `.${extension}`),
].join(",");

/** Taille lisible (« 2,4 Mo »), pour l'affichage formateur et élève. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} o`;
  const units = ["Ko", "Mo", "Go"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded).replace(".", ",")} ${units[unitIndex]}`;
}

/**
 * Adresse de lecture d'une pièce jointe de leçon.
 *
 * Jamais l'URL de stockage : celle-ci ne porte aucun contrôle, et un lien
 * partagé une fois resterait valable pour toujours. Ce chemin-ci passe par
 * `/api/lecons/…`, qui vérifie l'inscription à chaque requête.
 *
 * `download` bascule la réponse en pièce jointe plutôt qu'en affichage — la
 * même ressource se prévisualise et se télécharge, seule l'intention change.
 */
export function lessonResourceHref(
  lessonId: string,
  resourceId: string,
  download = false,
): string {
  const base = `/api/lecons/${encodeURIComponent(lessonId)}/ressource/${encodeURIComponent(resourceId)}`;
  return download ? `${base}?dl=1` : base;
}
