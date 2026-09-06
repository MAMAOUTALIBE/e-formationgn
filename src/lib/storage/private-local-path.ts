import os from "node:os";
import path from "node:path";

const PRODUCTION_PRIVATE_UPLOAD_ROOT = "/app/private-uploads";
const DEVELOPMENT_PRIVATE_UPLOAD_ROOT = path.join(
  os.tmpdir(),
  "e-formationgn-private-uploads",
);

export function privateUploadRoot(environment = process.env): string {
  const configured = environment.PRIVATE_UPLOAD_ROOT?.trim();
  const root = path.resolve(
    configured ||
      (environment.NODE_ENV === "production"
        ? PRODUCTION_PRIVATE_UPLOAD_ROOT
        : DEVELOPMENT_PRIVATE_UPLOAD_ROOT),
  );
  const publicRoot = path.resolve(process.cwd(), "public");

  if (root === path.parse(root).root) {
    throw new Error("PRIVATE_UPLOAD_ROOT ne peut pas être la racine du système.");
  }
  if (root === publicRoot || root.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error("PRIVATE_UPLOAD_ROOT doit être situé hors du dossier public.");
  }
  return root;
}

export function resolvePrivateStoredFilePath(
  key: string,
  environment = process.env,
): string | null {
  const segments = key.split("/");
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\\") ||
        segment.includes("\0"),
    )
  ) {
    return null;
  }

  const root = privateUploadRoot(environment);
  const resolved = path.resolve(root, ...segments);
  return resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}
