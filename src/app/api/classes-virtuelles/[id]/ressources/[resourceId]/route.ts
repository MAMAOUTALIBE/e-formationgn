import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveLocalStoredFilePath } from "@/lib/storage/local";
import { streamStoredFile } from "@/lib/storage/stream-file";
import { getVirtualClassViewer } from "@/server/queries/virtual-classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const CACHE = "private, max-age=0, must-revalidate";

async function serve(request: Request, context: { params: Promise<{ id: string; resourceId: string }> }, headOnly: boolean) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const { id, resourceId } = await context.params;
  const viewer = await getVirtualClassViewer(id, session.user.id, session.user.role);
  if (!viewer) return NextResponse.json({ error: "Ressource introuvable." }, { status: 404 });
  const resource = await prisma.virtualClassResource.findFirst({ where: { id: resourceId, virtualClassId: id } });
  if (!resource) return NextResponse.json({ error: "Ressource introuvable." }, { status: 404 });
  if (viewer.viewerRole === "STUDENT") {
    const visible = resource.visibility === "ALWAYS" || (resource.visibility === "BEFORE" && viewer.status !== "ENDED") || (resource.visibility === "DURING" && (viewer.status === "OPEN" || viewer.status === "LIVE")) || (resource.visibility === "AFTER" && viewer.status === "ENDED");
    if (!visible) return NextResponse.json({ error: "Ce document n’est pas disponible à ce moment de la séance." }, { status: 403 });
  }
  const download = new URL(request.url).searchParams.get("dl") === "1";
  if (download && !resource.downloadable && viewer.viewerRole === "STUDENT") return NextResponse.json({ error: "Téléchargement désactivé." }, { status: 403 });
  if (resource.storageUrl.startsWith("/uploads/")) {
    const filePath = resolveLocalStoredFilePath(resource.storageUrl.replace(/^\/uploads\//, "").split("/"));
    if (!filePath) return NextResponse.json({ error: "Ressource introuvable." }, { status: 404 });
    return streamStoredFile({ filePath, contentType: resource.contentType, request, headOnly, cacheControl: CACHE, downloadName: download ? resource.title : undefined });
  }
  const upstream = await fetch(resource.storageUrl, { method: headOnly ? "HEAD" : "GET", headers: request.headers.get("range") ? { range: request.headers.get("range")! } : undefined, cache: "no-store" }).catch(() => null);
  if (!upstream?.ok) return NextResponse.json({ error: "Le fichier n’est pas accessible." }, { status: 502 });
  const headers = new Headers({ "content-type": resource.contentType, "cache-control": CACHE, "x-content-type-options": "nosniff" });
  if (download) headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(resource.title)}`);
  for (const name of ["content-length", "content-range"]) { const value = upstream.headers.get(name); if (value) headers.set(name, value); }
  return new Response(headOnly ? null : upstream.body, { status: upstream.status, headers });
}

export function GET(request: Request, context: { params: Promise<{ id: string; resourceId: string }> }) { return serve(request, context, false); }
export function HEAD(request: Request, context: { params: Promise<{ id: string; resourceId: string }> }) { return serve(request, context, true); }
