import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { parseHttpByteRange } from "@/lib/http-byte-range";
import { resourceUploadContentType } from "@/lib/resource-file";
import { resolveLocalStoredFilePath } from "@/lib/storage/local";
import { isLikelyVideoFile, videoUploadContentType } from "@/lib/video-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Préfixe de stockage des pièces jointes de leçon — cf. la route de presign. */
const RESOURCE_PREFIX = "resources";
const PRESENTATION_PREFIX = "presentations";

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
  const known = OTHER_CONTENT_TYPES[extension];
  if (known) return known;
  if (isLikelyVideoFile(filename, "")) return videoUploadContentType(filename, "");
  // Pièces jointes de leçon : sans ce mappage un PDF partait en
  // `application/octet-stream`, donc en téléchargement forcé plutôt qu'en
  // aperçu dans le navigateur. La table de `resource-file` ne renvoie jamais
  // de type exécutable (HTML, SVG), l'élargissement reste sans risque.
  return resourceUploadContentType(filename, "");
}

async function serve(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
  headOnly: boolean,
): Promise<Response> {
  const segments = (await context.params).path;

  // Cette route est publique par nature : elle sert les avatars et les
  // vignettes, que tout le monde peut voir. Les supports de cours, eux, ne
  // s'obtiennent que par `/api/lecons/…`, qui vérifie l'inscription. Les
  // refuser ICI est ce qui ferme la porte — la route protégée lit le disque
  // directement et ne repasse pas par ce chemin.
  if (
    segments[0] === RESOURCE_PREFIX ||
    segments[0] === PRESENTATION_PREFIX
  ) {
    return new Response("Introuvable", { status: 404 });
  }

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
