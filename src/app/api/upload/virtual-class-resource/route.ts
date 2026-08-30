import { NextResponse } from "next/server";

import { isAllowedResourceFile, resourceSizeLimitFor, resourceUploadContentType } from "@/lib/resource-file";
import { createLocalUpload } from "@/lib/storage/local";
import { createPresignedUpload, isR2Configured } from "@/lib/storage/r2";
import { requireVirtualClassModerator, VirtualClassAccessError } from "@/server/services/virtual-class-access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { virtualClassId?: string; filename?: string; contentType?: string; sizeBytes?: number };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  if (!body.virtualClassId || !body.filename || typeof body.sizeBytes !== "number") return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 });
  try {
    const { session, virtualClass } = await requireVirtualClassModerator(body.virtualClassId);
    if (virtualClass.status === "ENDED" || virtualClass.status === "CANCELLED") return NextResponse.json({ error: "Cette séance n’accepte plus de documents." }, { status: 409 });
    if (!isAllowedResourceFile(body.filename, body.contentType ?? "")) return NextResponse.json({ error: "Format de fichier non supporté." }, { status: 400 });
    if (!Number.isSafeInteger(body.sizeBytes) || body.sizeBytes <= 0) return NextResponse.json({ error: "Taille de fichier invalide." }, { status: 400 });
    const limit = resourceSizeLimitFor(body.filename, body.contentType ?? "");
    if (limit !== null && body.sizeBytes > limit) return NextResponse.json({ error: `Fichier trop lourd (max ${Math.round(limit / 1_048_576)} Mo).` }, { status: 400 });
    const contentType = resourceUploadContentType(body.filename, body.contentType ?? "");
    const prefix = `resources/virtual-classes/${session.userId}`;
    const result = isR2Configured()
      ? await createPresignedUpload({ prefix, filename: body.filename, contentType, maxSizeBytes: body.sizeBytes, expiresInSeconds: 600 })
      : createLocalUpload({ prefix, filename: body.filename, expiresInSeconds: 600 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof VirtualClassAccessError) return NextResponse.json({ error: error.message }, { status: error.code === "NOT_FOUND" ? 404 : 403 });
    return NextResponse.json({ error: "Impossible de préparer le dépôt." }, { status: 500 });
  }
}
