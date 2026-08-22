import "server-only";

// Envoi d'un fichier stocké, avec gestion des requêtes par plage d'octets.
//
// Extrait de la route publique `/uploads/[...path]` pour être partagé avec la
// route protégée des ressources de leçon : les deux servent des octets, seule
// l'autorisation les distingue. Dupliquer la lecture par plages aurait garanti
// qu'une correction n'atteigne qu'un des deux chemins — et la lecture vidéo,
// qui repose entièrement sur ces plages, se serait mise à diverger d'un
// endroit à l'autre.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { parseHttpByteRange } from "@/lib/http-byte-range";

export interface StreamOptions {
  filePath: string;
  contentType: string;
  /** Requête d'origine, pour lire l'en-tête `Range`. */
  request: Request;
  headOnly?: boolean;
  /** `private` pour un contenu réservé, `public` pour un fichier ouvert. */
  cacheControl: string;
  /** Nom proposé au téléchargement ; omis, le fichier s'affiche en ligne. */
  downloadName?: string;
}

export async function streamStoredFile(options: StreamOptions): Promise<Response> {
  const { filePath, contentType, request, headOnly, cacheControl } = options;

  let fileStat;
  try {
    fileStat = await stat(filePath);
    if (!fileStat.isFile()) return new Response("Introuvable", { status: 404 });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }

  const range = parseHttpByteRange(request.headers.get("range"), fileStat.size);
  const commonHeaders: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl,
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  };
  if (options.downloadName) {
    // `filename*` en UTF-8 : les supports de cours portent des accents, et la
    // forme simple les rend illisibles chez le destinataire.
    commonHeaders["Content-Disposition"] =
      `attachment; filename*=UTF-8''${encodeURIComponent(options.downloadName)}`;
  }

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
