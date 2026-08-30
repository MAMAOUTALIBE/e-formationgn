import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getR2Object } from "@/lib/storage/r2";
import { getVirtualClassViewer } from "@/server/queries/virtual-classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function serve(request: Request, context: { params: Promise<{ id: string; recordingId: string }> }, headOnly: boolean) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const { id, recordingId } = await context.params;
  const viewer = await getVirtualClassViewer(id, session.user.id, session.user.role);
  if (!viewer) return NextResponse.json({ error: "Replay introuvable." }, { status: 404 });
  const recording = await prisma.virtualClassRecording.findFirst({ where: { id: recordingId, virtualClassId: id, status: "READY", ...(viewer.viewerRole === "STUDENT" ? { visible: true } : {}) } });
  if (!recording?.storageKey) return NextResponse.json({ error: "Replay indisponible." }, { status: 404 });
  try {
    const object = await getR2Object(recording.storageKey, request.headers.get("range"));
    const headers = new Headers({ "content-type": object.ContentType ?? "video/mp4", "cache-control": "private, no-store", "accept-ranges": object.AcceptRanges ?? "bytes", "x-content-type-options": "nosniff" });
    if (object.ContentLength !== undefined) headers.set("content-length", String(object.ContentLength));
    if (object.ContentRange) headers.set("content-range", object.ContentRange);
    return new Response(headOnly ? null : object.Body?.transformToWebStream(), { status: object.ContentRange ? 206 : 200, headers });
  } catch {
    return NextResponse.json({ error: "Le replay n’est pas accessible." }, { status: 502 });
  }
}

export function GET(request: Request, context: { params: Promise<{ id: string; recordingId: string }> }) { return serve(request, context, false); }
export function HEAD(request: Request, context: { params: Promise<{ id: string; recordingId: string }> }) { return serve(request, context, true); }
