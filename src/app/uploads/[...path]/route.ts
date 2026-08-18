import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { parseHttpByteRange } from "@/lib/http-byte-range";
import { resolveLocalStoredFilePath } from "@/lib/storage/local";
import { videoUploadContentType } from "@/lib/video-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OTHER_CONTENT_TYPES: Readonly<Record<string, string>> = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

function contentTypeFor(filename: string): string {
  const extension = filename.toLowerCase().split(".").pop() ?? "";
  return (
    OTHER_CONTENT_TYPES[extension] ??
    videoUploadContentType(filename, "") ??
    "application/octet-stream"
  );
}

async function serve(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
  headOnly: boolean,
): Promise<Response> {
  const segments = (await context.params).path;
  const filePath = resolveLocalStoredFilePath(segments);
  if (!filePath) return new Response("Introuvable", { status: 404 });

  let fileStat;
  try {
    fileStat = await stat(filePath);
    if (!fileStat.isFile()) return new Response("Introuvable", { status: 404 });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }

  const range = parseHttpByteRange(request.headers.get("range"), fileStat.size);
  const commonHeaders = {
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Content-Type": contentTypeFor(segments.at(-1) ?? ""),
    "X-Content-Type-Options": "nosniff",
  };

  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: { ...commonHeaders, "Content-Range": `bytes */${fileStat.size}` },
    });
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? Math.max(0, fileStat.size - 1);
  const contentLength = fileStat.size === 0 ? 0 : end - start + 1;
  const headers: Record<string, string> = {
    ...commonHeaders,
    "Content-Length": String(contentLength),
  };
  if (range) headers["Content-Range"] = `bytes ${start}-${end}/${fileStat.size}`;

  if (headOnly || fileStat.size === 0) {
    return new Response(null, { status: range ? 206 : 200, headers });
  }

  const stream = createReadStream(filePath, { start, end });
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: range ? 206 : 200,
    headers,
  });
}

export function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return serve(request, context, false);
}

export function HEAD(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return serve(request, context, true);
}
