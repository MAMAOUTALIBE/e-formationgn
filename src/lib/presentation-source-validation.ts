import { inflateRawSync } from "node:zlib";

import { presentationExtensionOf } from "@/lib/presentation-file";

export type PresentationSourceValidation =
  | { valid: true }
  | { valid: false; message: string };

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const MAX_ZIP_ENTRIES = 10_000;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;
const MAX_REQUIRED_XML_BYTES = 8 * 1024 * 1024;

function invalid(message: string): PresentationSourceValidation {
  return { valid: false, message };
}

function hasUnsafeZipPath(name: string): boolean {
  const candidate = name.endsWith("/") ? name.slice(0, -1) : name;
  return (
    name.includes("\0") ||
    name.includes("\\") ||
    name.startsWith("/") ||
    /^[a-zA-Z]:/.test(name) ||
    !candidate ||
    candidate.split("/").some((segment) => segment === ".." || segment === "")
  );
}

function findEndOfCentralDirectory(bytes: Buffer): number {
  const minimumOffset = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (bytes.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) return offset;
  }
  return -1;
}

function parseZipEntries(bytes: Buffer): ZipEntry[] | string {
  if (bytes.length < 22 || bytes.readUInt32LE(0) !== ZIP_LOCAL_SIGNATURE) {
    return "Le fichier .pptx n'est pas une archive ZIP valide.";
  }
  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) return "Répertoire ZIP central introuvable.";

  const diskNumber = bytes.readUInt16LE(eocdOffset + 4);
  const centralDisk = bytes.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = bytes.readUInt16LE(eocdOffset + 8);
  const entryCount = bytes.readUInt16LE(eocdOffset + 10);
  const centralSize = bytes.readUInt32LE(eocdOffset + 12);
  const centralOffset = bytes.readUInt32LE(eocdOffset + 16);
  const commentLength = bytes.readUInt16LE(eocdOffset + 20);

  if (eocdOffset + 22 + commentLength !== bytes.length) {
    return "Fin d'archive ZIP incohérente.";
  }
  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
    return "Les archives ZIP multi-volumes ne sont pas acceptées.";
  }
  if (
    entryCount === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  ) {
    return "Le format ZIP64 n'est pas accepté pour un diaporama.";
  }
  if (entryCount === 0 || entryCount > MAX_ZIP_ENTRIES) {
    return "Le nombre de fichiers internes du PowerPoint est invalide.";
  }
  if (
    centralOffset > eocdOffset ||
    centralSize > eocdOffset ||
    centralOffset + centralSize !== eocdOffset
  ) {
    return "Répertoire ZIP central incohérent.";
  }

  const entries: ZipEntry[] = [];
  const names = new Set<string>();
  let cursor = centralOffset;
  let totalCompressed = 0;
  let totalUncompressed = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > eocdOffset || bytes.readUInt32LE(cursor) !== ZIP_CENTRAL_SIGNATURE) {
      return "Entrée ZIP centrale invalide.";
    }
    const flags = bytes.readUInt16LE(cursor + 8);
    const compressionMethod = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const entryCommentLength = bytes.readUInt16LE(cursor + 32);
    const diskStart = bytes.readUInt16LE(cursor + 34);
    const localHeaderOffset = bytes.readUInt32LE(cursor + 42);
    const entryEnd = cursor + 46 + nameLength + extraLength + entryCommentLength;
    if (entryEnd > eocdOffset) return "Entrée ZIP tronquée.";
    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff ||
      localHeaderOffset + 30 > centralOffset
    ) {
      return "L'emplacement d'une entrée ZIP est invalide.";
    }
    if ((flags & 0x1) !== 0) return "Les PowerPoint chiffrés ne sont pas acceptés.";
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      return "Le PowerPoint utilise une compression ZIP non prise en charge.";
    }
    if (diskStart !== 0) return "Les archives ZIP multi-volumes ne sont pas acceptées.";

    const name = bytes.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    if (!name || hasUnsafeZipPath(name)) {
      return "Le PowerPoint contient un chemin interne dangereux.";
    }
    if (names.has(name)) return "Le PowerPoint contient une entrée ZIP dupliquée.";
    names.add(name);

    totalCompressed += compressedSize;
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      return "Le taux de compression du PowerPoint est dangereux.";
    }
    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    cursor = entryEnd;
  }

  if (cursor !== eocdOffset) return "Répertoire ZIP central incomplet.";
  if (totalUncompressed / Math.max(totalCompressed, 1) > MAX_COMPRESSION_RATIO) {
    return "Le taux de compression du PowerPoint est dangereux.";
  }
  return entries;
}

function readZipEntry(bytes: Buffer, entry: ZipEntry): Buffer | null {
  if (
    entry.uncompressedSize > MAX_REQUIRED_XML_BYTES ||
    entry.localHeaderOffset + 30 > bytes.length ||
    bytes.readUInt32LE(entry.localHeaderOffset) !== ZIP_LOCAL_SIGNATURE
  ) {
    return null;
  }
  const localNameLength = bytes.readUInt16LE(entry.localHeaderOffset + 26);
  const localExtraLength = bytes.readUInt16LE(entry.localHeaderOffset + 28);
  const localNameStart = entry.localHeaderOffset + 30;
  const localNameEnd = localNameStart + localNameLength;
  if (
    localNameEnd > bytes.length ||
    bytes.toString("utf8", localNameStart, localNameEnd) !== entry.name
  ) {
    return null;
  }
  const dataOffset = localNameEnd + localExtraLength;
  const dataEnd = dataOffset + entry.compressedSize;
  if (dataOffset > bytes.length || dataEnd > bytes.length) return null;
  const compressed = bytes.subarray(dataOffset, dataEnd);

  try {
    const content =
      entry.compressionMethod === 0
        ? Buffer.from(compressed)
        : entry.compressionMethod === 8
          ? inflateRawSync(compressed, { maxOutputLength: MAX_REQUIRED_XML_BYTES })
          : null;
    if (!content || content.length !== entry.uncompressedSize) return null;
    return content;
  } catch {
    return null;
  }
}

function validatePptx(bytes: Buffer): PresentationSourceValidation {
  const parsed = parseZipEntries(bytes);
  if (typeof parsed === "string") return invalid(parsed);
  const byName = new Map(parsed.map((entry) => [entry.name, entry]));
  const contentTypesEntry = byName.get("[Content_Types].xml");
  const presentationEntry = byName.get("ppt/presentation.xml");
  if (!contentTypesEntry || !presentationEntry) {
    return invalid("La structure PresentationML minimale est absente.");
  }

  const contentTypes = contentTypesEntry
    ? readZipEntry(bytes, contentTypesEntry)?.toString("utf8")
    : null;
  const presentation = presentationEntry
    ? readZipEntry(bytes, presentationEntry)?.toString("utf8")
    : null;
  if (!contentTypes || !presentation) {
    return invalid("Les fichiers XML principaux du PowerPoint sont illisibles.");
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(contentTypes + presentation)) {
    return invalid("Les déclarations XML externes ne sont pas acceptées.");
  }
  if (
    !/PartName=["']\/ppt\/presentation\.xml["']/i.test(contentTypes) ||
    !/application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation\.main\+xml/i.test(
      contentTypes,
    )
  ) {
    return invalid("Le manifeste du fichier ne déclare pas une présentation PowerPoint.");
  }
  if (
    !/<(?:[A-Za-z_][\w.-]*:)?presentation\b/i.test(presentation) ||
    !/http:\/\/schemas\.openxmlformats\.org\/presentationml\/2006\/main/i.test(
      presentation,
    )
  ) {
    return invalid("Le document principal n'est pas une présentation PresentationML.");
  }
  return { valid: true };
}

export function validatePresentationSourceBytes(
  filename: string,
  bytes: Buffer,
): PresentationSourceValidation {
  const extension = presentationExtensionOf(filename);
  if (extension === "pptx") return validatePptx(bytes);
  return invalid(
    /\.ppt$/i.test(filename.trim())
      ? "L’ancien format .ppt doit être réenregistré en .pptx."
      : "Extension PowerPoint non prise en charge.",
  );
}
