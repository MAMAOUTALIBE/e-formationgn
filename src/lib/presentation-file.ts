// Règles isomorphes du fichier PowerPoint source. Elles sont utilisées par le
// navigateur pour un retour immédiat et répétées par la route d'upload.

export const MAX_PRESENTATION_BYTES = 100 * 1024 * 1024; // 100 Mio
export const PRESENTATION_ACCEPT_ATTRIBUTE = ".pptx";

const CONTENT_TYPE_BY_EXTENSION = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

export function presentationExtensionOf(filename: string): "pptx" | null {
  const extension = filename.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return extension === "pptx" ? extension : null;
}

export function isAllowedPresentationFile(filename: string): boolean {
  return presentationExtensionOf(filename) !== null;
}

export function presentationFileError(filename: string): string {
  if (/\.ppt$/i.test(filename.trim())) {
    return "L’ancien format .ppt n’est pas accepté. Ouvrez-le dans PowerPoint ou LibreOffice puis réenregistrez-le en .pptx.";
  }
  return "Seuls les fichiers PowerPoint .pptx sont acceptés.";
}

export function presentationUploadContentType(filename: string): string {
  const extension = presentationExtensionOf(filename);
  return extension ? CONTENT_TYPE_BY_EXTENSION[extension] : "application/octet-stream";
}

function storageSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

export function presentationSourcePrefix(userId: string, lessonId: string): string {
  return `presentations/source/${storageSegment(userId)}/${storageSegment(lessonId)}`;
}

export function presentationSourceKeyBelongsTo(
  key: string,
  userId: string,
  lessonId: string,
): boolean {
  const prefix = presentationSourcePrefix(userId, lessonId);
  return key.startsWith(`${prefix}/`) && !key.includes("\\") && !key.includes("../");
}
