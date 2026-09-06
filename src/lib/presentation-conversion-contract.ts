import { pathToFileURL } from "node:url";

export const PRESENTATION_STALE_AFTER_MS = 15 * 60 * 1000;
export const MAX_CONVERTED_SLIDES = 500;

export interface PresentationCommand {
  command: string;
  args: string[];
  timeoutMs: number;
}

export interface NormalizedRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class PresentationConversionError extends Error {
  constructor(
    readonly safeMessage: string,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "PresentationConversionError";
  }
}

export function buildLibreOfficeCommand(
  sourcePath: string,
  outputDirectory: string,
  profileDirectory: string,
): PresentationCommand {
  return {
    command: "soffice",
    args: [
      "--headless",
      "--nologo",
      "--nodefault",
      "--nolockcheck",
      "--nofirststartwizard",
      `-env:UserInstallation=${pathToFileURL(profileDirectory).href}`,
      "--convert-to",
      "pdf:impress_pdf_Export",
      "--outdir",
      outputDirectory,
      sourcePath,
    ],
    timeoutMs: 180_000,
  };
}

export function buildPopplerRenderCommand(
  pdfPath: string,
  outputPrefix: string,
): PresentationCommand {
  return {
    command: "pdftoppm",
    args: ["-png", "-scale-to", "2048", pdfPath, outputPrefix],
    timeoutMs: 180_000,
  };
}

export function isPresentationClaimable(
  status: "UPLOADED" | "PROCESSING" | "READY" | "ERROR",
  updatedAt: Date,
  now = new Date(),
  staleAfterMs = PRESENTATION_STALE_AFTER_MS,
): boolean {
  return (
    status === "UPLOADED" ||
    (status === "PROCESSING" &&
      updatedAt.getTime() <= now.getTime() - staleAfterMs)
  );
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function normalizeViewportRectangle(
  rectangle: readonly number[],
  pageWidth: number,
  pageHeight: number,
): NormalizedRectangle | null {
  if (
    rectangle.length !== 4 ||
    !rectangle.every(Number.isFinite) ||
    !Number.isFinite(pageWidth) ||
    !Number.isFinite(pageHeight) ||
    pageWidth <= 0 ||
    pageHeight <= 0
  ) {
    return null;
  }
  const left = clamp(Math.min(rectangle[0], rectangle[2]) / pageWidth);
  const right = clamp(Math.max(rectangle[0], rectangle[2]) / pageWidth);
  const top = clamp(Math.min(rectangle[1], rectangle[3]) / pageHeight);
  const bottom = clamp(Math.max(rectangle[1], rectangle[3]) / pageHeight);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;
  return { x: left, y: top, width, height };
}

export function safeExternalPresentationUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeInternalSlideDestination(
  pageIndex: unknown,
  pageCount: number,
): number | null {
  return Number.isSafeInteger(pageIndex) &&
    typeof pageIndex === "number" &&
    pageIndex >= 0 &&
    pageIndex < pageCount
    ? pageIndex
    : null;
}

export function sanitizePresentationConversionError(error: unknown): string {
  if (error instanceof PresentationConversionError) {
    return error.safeMessage.slice(0, 500);
  }
  return "La conversion a échoué. Vérifiez le fichier puis réessayez.";
}
