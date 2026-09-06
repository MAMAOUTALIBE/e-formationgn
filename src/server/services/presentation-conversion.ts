import "server-only";

import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { PDFDocumentProxy } from "pdfjs-dist";

import { Prisma } from "@/generated/prisma/client";
import {
  MAX_CONVERTED_SLIDES,
  PRESENTATION_STALE_AFTER_MS,
  PresentationConversionError,
  buildLibreOfficeCommand,
  buildPopplerRenderCommand,
  normalizeInternalSlideDestination,
  normalizeViewportRectangle,
  safeExternalPresentationUrl,
  sanitizePresentationConversionError,
  type NormalizedRectangle,
  type PresentationCommand,
} from "@/lib/presentation-conversion-contract";
import { MAX_PRESENTATION_BYTES } from "@/lib/presentation-file";
import { prisma } from "@/lib/prisma";
import {
  deletePrivateObject,
  deletePrivateObjectPrefix,
  getPrivateObjectBytes,
  putPrivateObject,
} from "@/lib/storage/private-object";

interface ClaimedPresentation {
  id: string;
  sourceKey: string;
  originalFileName: string;
  processingToken: string;
  claimedAt: Date;
  previousProcessingToken: string | null;
}

interface ConvertedHotspot extends NormalizedRectangle {
  kind: "EXTERNAL_URL" | "INTERNAL_SLIDE";
  externalUrl: string | null;
  targetSlideOrder: number | null;
  ariaLabel: string | null;
}

interface ConvertedSlide {
  displayOrder: number;
  imageKey: string;
  width: number;
  height: number;
  extractedText: string | null;
  hotspots: ConvertedHotspot[];
}

interface PdfAnnotationLike {
  subtype?: unknown;
  rect?: unknown;
  url?: unknown;
  unsafeUrl?: unknown;
  dest?: unknown;
  titleObj?: unknown;
  contentsObj?: unknown;
}

const MAX_COMMAND_OUTPUT_BYTES = 64 * 1024;
const MAX_RENDERED_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_RENDERED_TOTAL_BYTES = 1024 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_CHARS = 100_000;
const MAX_HOTSPOTS_PER_SLIDE = 200;

function appendBounded(current: string, chunk: Buffer): string {
  if (current.length >= MAX_COMMAND_OUTPUT_BYTES) return current;
  return (current + chunk.toString("utf8")).slice(0, MAX_COMMAND_OUTPUT_BYTES);
}

export async function runPresentationCommand(spec: PresentationCommand): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(spec.command, spec.args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, spec.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendBounded(stdout, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendBounded(stderr, chunk);
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`timeout:${spec.command}`));
      } else if (code !== 0) {
        reject(new Error(`exit:${spec.command}:${code}:${stderr || stdout}`));
      } else {
        resolve();
      }
    });
  });
}

export async function claimNextPresentation(
  now = new Date(),
): Promise<ClaimedPresentation | null> {
  const staleBefore = new Date(now.getTime() - PRESENTATION_STALE_AFTER_MS);
  const processingToken = randomUUID();
  const rows = await prisma.$queryRaw<ClaimedPresentation[]>(Prisma.sql`
    WITH candidate AS (
      SELECT "id", "processingToken" AS "previousProcessingToken"
      FROM "Presentation"
      WHERE
        "status" = 'UPLOADED'::"PresentationStatus"
        OR (
          "status" = 'PROCESSING'::"PresentationStatus"
          AND "updatedAt" <= ${staleBefore}
        )
      ORDER BY
        CASE WHEN "status" = 'UPLOADED'::"PresentationStatus" THEN 0 ELSE 1 END,
        "updatedAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    ), claimed AS (
      UPDATE "Presentation" AS presentation
      SET
        "status" = 'PROCESSING'::"PresentationStatus",
        "processingToken" = ${processingToken},
        "processingStartedAt" = ${now},
        "errorMessage" = NULL,
        "updatedAt" = ${now}
      FROM candidate
      WHERE presentation."id" = candidate."id"
      RETURNING
        presentation."id",
        presentation."sourceKey",
        presentation."originalFileName",
        presentation."processingToken",
        presentation."updatedAt" AS "claimedAt"
    )
    SELECT claimed.*, candidate."previousProcessingToken"
    FROM claimed
    JOIN candidate ON candidate."id" = claimed."id"
  `);
  return rows[0] ?? null;
}

function renderPrefix(presentationId: string, processingToken: string): string {
  return `presentations/rendered/${presentationId}/${processingToken}`;
}

async function heartbeatClaim(claim: ClaimedPresentation): Promise<void> {
  const heartbeat = await prisma.presentation.updateMany({
    where: {
      id: claim.id,
      status: "PROCESSING",
      processingToken: claim.processingToken,
    },
    data: { updatedAt: new Date() },
  });
  if (heartbeat.count !== 1) {
    throw new PresentationConversionError(
      "La conversion a été interrompue par une mise à jour du diaporama.",
      "conversion_lease_lost",
    );
  }
}

function stringFromAnnotationValue(value: unknown): string | null {
  if (typeof value === "string") return value.slice(0, 300);
  if (value && typeof value === "object" && "str" in value) {
    const str = (value as { str?: unknown }).str;
    return typeof str === "string" ? str.slice(0, 300) : null;
  }
  return null;
}

async function destinationPageIndex(
  document: PDFDocumentProxy,
  destination: unknown,
): Promise<number | null> {
  let resolved = destination;
  if (typeof destination === "string") {
    resolved = await document.getDestination(destination);
  }
  if (!Array.isArray(resolved) || resolved.length === 0) return null;
  const reference = resolved[0];
  if (typeof reference === "number") {
    return normalizeInternalSlideDestination(reference, document.numPages);
  }
  if (
    !reference ||
    typeof reference !== "object" ||
    !("num" in reference) ||
    !("gen" in reference)
  ) {
    return null;
  }
  try {
    const pageIndex = await document.getPageIndex(
      reference as Parameters<PDFDocumentProxy["getPageIndex"]>[0],
    );
    return normalizeInternalSlideDestination(pageIndex, document.numPages);
  } catch {
    return null;
  }
}

async function extractPdfSlides(pdfBytes: Buffer): Promise<
  Array<Pick<ConvertedSlide, "displayOrder" | "extractedText" | "hotspots">>
> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({
    data: new Uint8Array(pdfBytes),
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  try {
    if (document.numPages <= 0 || document.numPages > MAX_CONVERTED_SLIDES) {
      throw new PresentationConversionError(
        `Le diaporama doit contenir entre 1 et ${MAX_CONVERTED_SLIDES} diapositives.`,
        "invalid_slide_count",
      );
    }

    const slides: Array<
      Pick<ConvertedSlide, "displayOrder" | "extractedText" | "hotspots">
    > = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const [textContent, annotations] = await Promise.all([
        page.getTextContent(),
        page.getAnnotations({ intent: "display" }),
      ]);
      const extractedText = textContent.items
        .map((item) =>
          typeof item === "object" && item && "str" in item
            ? String(item.str)
            : "",
        )
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_EXTRACTED_TEXT_CHARS);
      const hotspots: ConvertedHotspot[] = [];

      for (const rawAnnotation of annotations.slice(0, MAX_HOTSPOTS_PER_SLIDE)) {
        const annotation = rawAnnotation as PdfAnnotationLike;
        if (annotation.subtype !== "Link" || !Array.isArray(annotation.rect)) {
          continue;
        }
        const viewportRectangle = viewport.convertToViewportRectangle(
          annotation.rect,
        );
        const rectangle = normalizeViewportRectangle(
          viewportRectangle,
          viewport.width,
          viewport.height,
        );
        if (!rectangle) continue;
        const ariaLabel =
          stringFromAnnotationValue(annotation.titleObj) ??
          stringFromAnnotationValue(annotation.contentsObj);
        const externalUrl = safeExternalPresentationUrl(
          annotation.url ?? annotation.unsafeUrl,
        );
        if (externalUrl) {
          hotspots.push({
            ...rectangle,
            kind: "EXTERNAL_URL",
            externalUrl,
            targetSlideOrder: null,
            ariaLabel: ariaLabel ?? externalUrl,
          });
          continue;
        }
        const targetSlideOrder = await destinationPageIndex(
          document,
          annotation.dest,
        );
        if (targetSlideOrder !== null) {
          hotspots.push({
            ...rectangle,
            kind: "INTERNAL_SLIDE",
            externalUrl: null,
            targetSlideOrder,
            ariaLabel: ariaLabel ?? `Aller à la diapositive ${targetSlideOrder + 1}`,
          });
        }
      }
      slides.push({
        displayOrder: pageNumber - 1,
        extractedText: extractedText || null,
        hotspots,
      });
      page.cleanup();
    }
    return slides;
  } finally {
    await document.destroy();
  }
}

function pngDimensions(bytes: Buffer): { width: number; height: number } {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (
    bytes.length < 24 ||
    !bytes.subarray(0, signature.length).equals(signature) ||
    bytes.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new PresentationConversionError(
      "Une image de diapositive générée est invalide.",
      "invalid_rendered_png",
    );
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width <= 0 || height <= 0) {
    throw new PresentationConversionError(
      "Les dimensions d’une diapositive sont invalides.",
      "invalid_rendered_dimensions",
    );
  }
  return { width, height };
}

async function convertClaimedPresentation(
  claim: ClaimedPresentation,
): Promise<ConvertedSlide[]> {
  const source = await getPrivateObjectBytes(claim.sourceKey, MAX_PRESENTATION_BYTES);
  if (!source) {
    throw new PresentationConversionError(
      "Le fichier PowerPoint source est introuvable ou incomplet.",
      "source_unavailable",
    );
  }

  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "aiduca-presentation-"),
  );
  const outputDirectory = path.join(temporaryRoot, "output");
  const profileDirectory = path.join(temporaryRoot, "libreoffice-profile");
  const sourcePath = path.join(temporaryRoot, "source.pptx");
  const pdfPath = path.join(outputDirectory, "source.pdf");
  const imagePrefix = path.join(outputDirectory, "slide");
  const renderedPrefix = renderPrefix(claim.id, claim.processingToken);

  try {
    await mkdir(outputDirectory, { recursive: true });
    await mkdir(profileDirectory, { recursive: true });
    await writeFile(sourcePath, source, { mode: 0o600 });
    try {
      await runPresentationCommand(
        buildLibreOfficeCommand(
          sourcePath,
          outputDirectory,
          profileDirectory,
        ),
      );
    } catch (error) {
      throw new PresentationConversionError(
        "PowerPoint n’a pas pu convertir ce fichier. Vérifiez qu’il s’ouvre correctement puis réessayez.",
        "libreoffice_failed",
        { cause: error },
      );
    }
    await heartbeatClaim(claim);

    let pdfBytes: Buffer;
    try {
      pdfBytes = await readFile(pdfPath);
    } catch (error) {
      throw new PresentationConversionError(
        "La conversion PowerPoint n’a produit aucun document exploitable.",
        "pdf_missing",
        { cause: error },
      );
    }
    const metadata = await extractPdfSlides(pdfBytes);
    await heartbeatClaim(claim);

    try {
      await runPresentationCommand(
        buildPopplerRenderCommand(
          pdfPath,
          imagePrefix,
        ),
      );
    } catch (error) {
      throw new PresentationConversionError(
        "Les images du diaporama n’ont pas pu être générées.",
        "poppler_failed",
        { cause: error },
      );
    }
    await heartbeatClaim(claim);

    const outputFiles = (await readdir(outputDirectory))
      .map((filename) => ({
        filename,
        match: /^slide-(\d+)\.png$/.exec(filename),
      }))
      .filter(
        (item): item is { filename: string; match: RegExpExecArray } =>
          item.match !== null,
      )
      .sort((left, right) => Number(left.match[1]) - Number(right.match[1]));
    if (outputFiles.length !== metadata.length) {
      throw new PresentationConversionError(
        "Le nombre d’images générées ne correspond pas aux diapositives.",
        "render_count_mismatch",
      );
    }

    const slides: ConvertedSlide[] = [];
    let totalImageBytes = 0;
    for (let index = 0; index < metadata.length; index += 1) {
      const expectedPage = index + 1;
      if (Number(outputFiles[index].match[1]) !== expectedPage) {
        throw new PresentationConversionError(
          "La séquence des diapositives générées est incomplète.",
          "render_sequence_mismatch",
        );
      }
      const imagePath = path.join(outputDirectory, outputFiles[index].filename);
      const imageStat = await stat(imagePath);
      totalImageBytes += imageStat.size;
      if (
        !imageStat.isFile() ||
        imageStat.size <= 0 ||
        imageStat.size > MAX_RENDERED_IMAGE_BYTES ||
        totalImageBytes > MAX_RENDERED_TOTAL_BYTES
      ) {
        throw new PresentationConversionError(
          "Les images générées dépassent la taille autorisée.",
          "rendered_output_too_large",
        );
      }
      const imageBytes = await readFile(imagePath);
      const dimensions = pngDimensions(imageBytes);
      const imageKey = `${renderedPrefix}/slide-${index}.png`;
      await putPrivateObject(imageKey, imageBytes, "image/png");
      slides.push({ ...metadata[index], ...dimensions, imageKey });
      if ((index + 1) % 20 === 0) await heartbeatClaim(claim);
    }

    return slides;
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function publishReady(
  claim: ClaimedPresentation,
  slides: ConvertedSlide[],
): Promise<boolean> {
  return prisma.$transaction(async (transaction) => {
    const lease = await transaction.presentation.updateMany({
      where: {
        id: claim.id,
        status: "PROCESSING",
        processingToken: claim.processingToken,
      },
      data: { updatedAt: new Date() },
    });
    if (lease.count !== 1) return false;

    await transaction.presentationSlide.deleteMany({
      where: { presentationId: claim.id },
    });
    for (const slide of slides) {
      await transaction.presentationSlide.create({
        data: {
          presentationId: claim.id,
          displayOrder: slide.displayOrder,
          imageKey: slide.imageKey,
          width: slide.width,
          height: slide.height,
          extractedText: slide.extractedText,
          hotspots: { create: slide.hotspots },
        },
      });
    }
    const extractedHotspots = slides.reduce(
      (total, slide) => total + slide.hotspots.length,
      0,
    );
    await transaction.presentation.update({
      where: { id: claim.id },
      data: {
        status: "READY",
        slideCount: slides.length,
        errorMessage: null,
        processingToken: null,
        processingStartedAt: null,
        compatibilityReport: {
          pipeline: "libreoffice-poppler-pdfjs",
          extractedHotspots,
          convertedAt: new Date().toISOString(),
        },
      },
    });
    return true;
  });
}

async function markConversionError(
  claim: ClaimedPresentation,
  error: unknown,
): Promise<boolean> {
  return prisma.$transaction(async (transaction) => {
    const lease = await transaction.presentation.updateMany({
      where: {
        id: claim.id,
        status: "PROCESSING",
        processingToken: claim.processingToken,
      },
      data: {
        status: "ERROR",
        slideCount: 0,
        errorMessage: sanitizePresentationConversionError(error),
        processingToken: null,
        processingStartedAt: null,
        compatibilityReport: Prisma.JsonNull,
      },
    });
    if (lease.count !== 1) return false;
    await transaction.presentationSlide.deleteMany({
      where: { presentationId: claim.id },
    });
    return true;
  });
}

async function cleanupKeys(keys: string[]): Promise<void> {
  await Promise.allSettled(keys.map((key) => deletePrivateObject(key)));
}

export type PresentationConversionRunResult =
  | { status: "idle" }
  | { status: "ready"; presentationId: string; slideCount: number }
  | { status: "error"; presentationId: string };

export async function processNextPresentation(): Promise<PresentationConversionRunResult> {
  const claim = await claimNextPresentation();
  if (!claim) return { status: "idle" };
  const currentPrefix = renderPrefix(claim.id, claim.processingToken);
  const previous = await prisma.presentation.findUnique({
    where: { id: claim.id },
    select: { slides: { select: { imageKey: true } } },
  });
  const oldImageKeys = previous?.slides.map((slide) => slide.imageKey) ?? [];

  if (
    claim.previousProcessingToken &&
    claim.previousProcessingToken !== claim.processingToken
  ) {
    await deletePrivateObjectPrefix(
      renderPrefix(claim.id, claim.previousProcessingToken),
    ).catch(() => {});
  }

  try {
    const converted = await convertClaimedPresentation(claim);
    const published = await publishReady(claim, converted);
    if (!published) {
      await deletePrivateObjectPrefix(currentPrefix).catch(() => {});
      return { status: "idle" };
    }
    await cleanupKeys(oldImageKeys);
    return {
      status: "ready",
      presentationId: claim.id,
      slideCount: converted.length,
    };
  } catch (error) {
    const marked = await markConversionError(claim, error).catch(() => false);
    await deletePrivateObjectPrefix(currentPrefix).catch(() => {});
    if (!marked) return { status: "idle" };
    await cleanupKeys(oldImageKeys);
    return { status: "error", presentationId: claim.id };
  }
}
