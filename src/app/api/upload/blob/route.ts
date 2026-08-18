import { unlink } from "node:fs/promises";
import { createWriteStream } from "node:fs";

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { resolveLocalUploadPath, verifyUploadToken } from "@/lib/storage/local";

// Réception d'un blob (image ou vidéo) et écriture sur disque local.
// Utilisée uniquement quand R2 n'est pas configuré (fallback dev / single-host).
// Le fichier est streamé sur disque pour ne pas charger les grosses vidéos en
// mémoire.

export const runtime = "nodejs";

const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB (couvre images + vidéos)

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
  const exp = Number(searchParams.get("exp"));
  const token = searchParams.get("token");
  if (!key || !token || !verifyUploadToken(key, exp, token)) {
    return NextResponse.json(
      { error: "Lien d'upload invalide ou expiré." },
      { status: 403 },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BYTES) {
    return NextResponse.json(
      { error: `Fichier trop lourd (max ${MAX_BYTES / (1024 * 1024)} MB).` },
      { status: 413 },
    );
  }

  if (!request.body) {
    return NextResponse.json({ error: "Corps vide." }, { status: 400 });
  }

  let dest: string;
  try {
    dest = await resolveLocalUploadPath(key);
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
      if (total > MAX_BYTES) {
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
        { error: `Fichier trop lourd (max ${MAX_BYTES / (1024 * 1024)} MB).` },
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
