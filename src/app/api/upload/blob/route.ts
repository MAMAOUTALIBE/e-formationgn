import { unlink } from "node:fs/promises";
import { createWriteStream } from "node:fs";

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  MAX_LOCAL_UPLOAD_BYTES,
  resolveLocalUploadPath,
  verifyUploadToken,
} from "@/lib/storage/local";
import type { LocalUploadScope } from "@/lib/storage/local-upload-token";
import { resolvePrivateLocalUploadPath } from "@/lib/storage/private-local";

// Réception d'un blob (image ou vidéo) et écriture sur disque local.
// Utilisée uniquement quand R2 n'est pas configuré (fallback dev / single-host).
// Le fichier est streamé sur disque pour ne pas charger les grosses vidéos en
// mémoire.

export const runtime = "nodejs";

export async function PUT(request: Request) {
  // Authentification suffisante : la vraie autorisation est le token signé
  // ci-dessous, émis par une route presign (course-thumbnail = formateur/admin,
  // avatar = tout user connecté) qui a déjà appliqué son contrôle de rôle.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const scope = searchParams.get("scope") as LocalUploadScope | null;
  const exp = Number(searchParams.get("exp"));
  const maxSizeBytes = Number(searchParams.get("max"));
  const token = searchParams.get("token");
  if (
    !key ||
    (scope !== "public" && scope !== "private") ||
    !token ||
    !verifyUploadToken(key, exp, token, maxSizeBytes, scope)
  ) {
    return NextResponse.json(
      { error: "Lien d'upload invalide ou expiré." },
      { status: 403 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > maxSizeBytes) {
    return NextResponse.json(
      { error: `Fichier trop lourd (max ${Math.floor(maxSizeBytes / (1024 * 1024))} MB).` },
      { status: 413 },
    );
  }

  if (!request.body) {
    return NextResponse.json({ error: "Corps vide." }, { status: 400 });
  }

  let dest: string;
  try {
    dest =
      scope === "private"
        ? await resolvePrivateLocalUploadPath(key)
        : await resolveLocalUploadPath(key);
  } catch (error) {
    console.error("[upload/blob] préparation du stockage", { key, error });
    return NextResponse.json(
      { error: "Le stockage vidéo n'est pas accessible. Réessayez." },
      { status: 500 },
    );
  }

  const ws = createWriteStream(dest);
  const reader = request.body.getReader();
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxSizeBytes || total > MAX_LOCAL_UPLOAD_BYTES) {
        throw new Error("TOO_LARGE");
      }
      if (!ws.write(value)) {
        await new Promise<void>((resolve) => ws.once("drain", resolve));
      }
    }
    await new Promise<void>((resolve, reject) => {
      ws.end((err?: NodeJS.ErrnoException | null) =>
        err ? reject(err) : resolve(),
      );
    });
  } catch (err) {
    ws.destroy();
    await unlink(dest).catch(() => {});
    if (err instanceof Error && err.message === "TOO_LARGE") {
      return NextResponse.json(
        { error: `Fichier trop lourd (max ${Math.floor(maxSizeBytes / (1024 * 1024))} MB).` },
        { status: 413 },
      );
    }
    console.error("[upload/blob]", err);
    return NextResponse.json(
      { error: "Échec de l'écriture du fichier." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, key });
}
