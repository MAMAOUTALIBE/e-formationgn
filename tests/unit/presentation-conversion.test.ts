import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { isCronBearerAuthorized } from "../../src/lib/cron-auth";
import {
  PRESENTATION_STALE_AFTER_MS,
  PresentationConversionError,
  buildLibreOfficeCommand,
  buildPopplerRenderCommand,
  isPresentationClaimable,
  normalizeInternalSlideDestination,
  normalizeViewportRectangle,
  safeExternalPresentationUrl,
  sanitizePresentationConversionError,
} from "../../src/lib/presentation-conversion-contract";

const root = process.cwd();
const read = (relativePath: string) =>
  readFile(path.join(root, relativePath), "utf8");

test("le claim reprend uniquement UPLOADED ou un PROCESSING périmé", () => {
  const now = new Date("2026-09-05T20:00:00.000Z");
  assert.equal(isPresentationClaimable("UPLOADED", now, now), true);
  assert.equal(isPresentationClaimable("READY", now, now), false);
  assert.equal(isPresentationClaimable("ERROR", now, now), false);
  assert.equal(
    isPresentationClaimable(
      "PROCESSING",
      new Date(now.getTime() - PRESENTATION_STALE_AFTER_MS + 1),
      now,
    ),
    false,
  );
  assert.equal(
    isPresentationClaimable(
      "PROCESSING",
      new Date(now.getTime() - PRESENTATION_STALE_AFTER_MS),
      now,
    ),
    true,
  );
});

test("le claim SQL est atomique, skip-locked et protégé par un lease", async () => {
  const [service, schema, migration] = await Promise.all([
    read("src/server/services/presentation-conversion.ts"),
    read("prisma/schema.prisma"),
    read(
      "prisma/migrations/20260905190000_presentation_conversion_pipeline/migration.sql",
    ),
  ]);
  assert.match(service, /FOR UPDATE SKIP LOCKED/);
  assert.match(service, /UPDATE "Presentation" AS presentation/);
  assert.match(service, /"processingToken" = \$\{processingToken\}/);
  assert.match(service, /processingToken: claim\.processingToken/);
  assert.match(service, /if \(lease\.count !== 1\) return false/);
  assert.match(service, /status: "READY"/);
  assert.match(service, /processingToken: null/);
  assert.match(schema, /processingToken\s+String\?\s+@unique/);
  assert.match(migration, /Presentation_processingToken_key/);
});

test("les URLs externes sont limitées à HTTP(S) sans identifiants", () => {
  assert.equal(
    safeExternalPresentationUrl("https://example.org/module?q=1"),
    "https://example.org/module?q=1",
  );
  assert.equal(
    safeExternalPresentationUrl("http://example.org/ressource"),
    "http://example.org/ressource",
  );
  assert.equal(safeExternalPresentationUrl("javascript:alert(1)"), null);
  assert.equal(safeExternalPresentationUrl("ftp://example.org/file"), null);
  assert.equal(safeExternalPresentationUrl("https://user:pass@example.org"), null);
  assert.equal(safeExternalPresentationUrl("//example.org/path"), null);
});

test("les rectangles PDF sont normalisés, bornés et non nuls", () => {
  assert.deepEqual(normalizeViewportRectangle([20, 10, 60, 30], 100, 50), {
    x: 0.2,
    y: 0.2,
    width: 0.39999999999999997,
    height: 0.39999999999999997,
  });
  assert.deepEqual(normalizeViewportRectangle([120, 60, -10, -5], 100, 50), {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });
  assert.equal(normalizeViewportRectangle([10, 10, 10, 20], 100, 50), null);
});

test("les destinations internes sont des index zéro-based valides", () => {
  assert.equal(normalizeInternalSlideDestination(0, 3), 0);
  assert.equal(normalizeInternalSlideDestination(2, 3), 2);
  assert.equal(normalizeInternalSlideDestination(3, 3), null);
  assert.equal(normalizeInternalSlideDestination(-1, 3), null);
  assert.equal(normalizeInternalSlideDestination("1", 3), null);
});

test("LibreOffice et Poppler reçoivent des tableaux d'arguments sans shell", async () => {
  const hostilePath = "/tmp/cours;touch-pwned.pptx";
  const libreOffice = buildLibreOfficeCommand(
    hostilePath,
    "/tmp/output dir",
    "/tmp/profile dir",
  );
  const poppler = buildPopplerRenderCommand(
    "/tmp/output dir/source.pdf",
    "/tmp/output dir/slide",
  );
  assert.equal(libreOffice.command, "soffice");
  assert.equal(libreOffice.args.at(-1), hostilePath);
  assert.equal(libreOffice.args.includes("--convert-to"), true);
  assert.deepEqual(poppler.args.slice(0, 3), ["-png", "-scale-to", "2048"]);

  const service = await read("src/server/services/presentation-conversion.ts");
  assert.match(service, /spawn\(spec\.command, spec\.args/);
  assert.match(service, /shell: false/);
  assert.match(service, /child\.kill\("SIGKILL"\)/);
  assert.doesNotMatch(service, /import \{[^}]*\bexec(?:File|Sync)?\b[^}]*\} from "node:child_process"/);
});

test("les erreurs persistées sont explicites mais ne divulguent rien", () => {
  const controlled = new PresentationConversionError(
    "Le document est invalide.",
    "private:/tmp/source.pptx",
  );
  assert.equal(
    sanitizePresentationConversionError(controlled),
    "Le document est invalide.",
  );
  assert.equal(
    sanitizePresentationConversionError(
      new Error("soffice failed /tmp/secret/source.pptx AWS_KEY=secret"),
    ),
    "La conversion a échoué. Vérifiez le fichier puis réessayez.",
  );
});

test("la route cron refuse tout secret absent ou incorrect", async () => {
  assert.equal(isCronBearerAuthorized(null, "secret"), false);
  assert.equal(isCronBearerAuthorized("Bearer secret", undefined), false);
  assert.equal(isCronBearerAuthorized("Bearer autre", "secret"), false);
  assert.equal(isCronBearerAuthorized("Bearer secret", "secret"), true);

  const route = await read("src/app/api/cron/convert-presentation/route.ts");
  assert.match(route, /isCronBearerAuthorized/);
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /status: 401/);
  assert.match(route, /processNextPresentation\(\)/);
});

test("READY est publié en transaction et ERROR nettoie les artefacts", async () => {
  const [service, storage, curriculum] = await Promise.all([
    read("src/server/services/presentation-conversion.ts"),
    read("src/lib/storage/private-object.ts"),
    read("src/server/actions/curriculum.ts"),
  ]);
  assert.match(service, /prisma\.\$transaction/);
  assert.match(service, /presentationSlide\.deleteMany/);
  assert.match(service, /hotspots: \{ create: slide\.hotspots \}/);
  assert.match(service, /status: "ERROR"/);
  assert.match(service, /sanitizePresentationConversionError\(error\)/);
  assert.match(service, /deletePrivateObjectPrefix\(currentPrefix\)/);
  assert.match(storage, /putPrivateObject/);
  assert.match(storage, /deletePrivateObjectPrefix/);
  assert.match(curriculum, /previous\?\.slides/);
  assert.match(curriculum, /presentation\.slides\.map/);
});

test("l'image runtime contient les convertisseurs, polices et cron minute", async () => {
  const [dockerfile, compose] = await Promise.all([
    read("Dockerfile"),
    read("docker-compose.yml"),
  ]);
  assert.match(dockerfile, /libreoffice poppler-utils/);
  assert.match(dockerfile, /font-dejavu font-liberation font-noto/);
  assert.match(compose, /\* \* \* \* \* curl[^\n]*convert-presentation/);
});
