import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  MAX_PRESENTATION_BYTES,
  isAllowedPresentationFile,
  presentationFileError,
  presentationSourceKeyBelongsTo,
  presentationSourcePrefix,
  presentationUploadContentType,
} from "../../src/lib/presentation-file";
import { validatePresentationSourceBytes } from "../../src/lib/presentation-source-validation";
import {
  createLocalUploadToken,
  verifyUploadToken,
} from "../../src/lib/storage/local-upload-token";
import {
  privateUploadRoot,
  resolvePrivateStoredFilePath,
} from "../../src/lib/storage/private-local-path";

const root = process.cwd();
const read = (relativePath: string) =>
  readFile(path.join(root, relativePath), "utf8");

interface TestZipEntry {
  name: string;
  content: string;
  declaredUncompressedSize?: number;
}

function createStoredZip(entries: TestZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const content = Buffer.from(entry.content, "utf8");
    const uncompressedSize = entry.declaredUncompressedSize ?? content.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(uncompressedSize, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(uncompressedSize, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, name);
    localOffset += local.length + name.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

const CONTENT_TYPES_XML = `<?xml version="1.0"?><Types><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>`;
const PRESENTATION_XML = `<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"></p:presentation>`;

test("seul le format PPTX est accepté avec un message de migration pour PPT", () => {
  assert.equal(isAllowedPresentationFile("cours.PPTX"), true);
  assert.equal(isAllowedPresentationFile("ancien.ppt"), false);
  assert.match(presentationFileError("ancien.ppt"), /réenregistrez-le en \.pptx/i);
  assert.equal(isAllowedPresentationFile("cours.pptx.exe"), false);
  assert.equal(isAllowedPresentationFile("cours.pdf"), false);
  assert.equal(MAX_PRESENTATION_BYTES, 100 * 1024 * 1024);
  assert.equal(
    presentationUploadContentType("cours.pptx"),
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  );
});

test("une clé de source est isolée par utilisateur et par leçon", () => {
  const prefix = presentationSourcePrefix("user/1", "lesson 1");
  assert.equal(prefix, "presentations/source/user_1/lesson_1");
  assert.equal(
    presentationSourceKeyBelongsTo(`${prefix}/source.pptx`, "user/1", "lesson 1"),
    true,
  );
  assert.equal(
    presentationSourceKeyBelongsTo(
      "presentations/source/user_1/other/source.pptx",
      "user/1",
      "lesson 1",
    ),
    false,
  );
});

test("la limite et la destination d'un upload local font partie de la signature", () => {
  const expiresAt = Date.now() + 60_000;
  const token = createLocalUploadToken(
    "presentations/source/u/l/file.pptx",
    expiresAt,
    1234,
    "private",
  );
  assert.equal(
    verifyUploadToken(
      "presentations/source/u/l/file.pptx",
      expiresAt,
      token,
      1234,
      "private",
    ),
    true,
  );
  assert.equal(
    verifyUploadToken(
      "presentations/source/u/l/file.pptx",
      expiresAt,
      token,
      1235,
      "private",
    ),
    false,
  );
  assert.equal(
    verifyUploadToken(
      "presentations/source/u/l/file.pptx",
      expiresAt,
      token,
      1234,
      "public",
    ),
    false,
  );
});

test("la validation binaire refuse PPT et reconnaît PresentationML", () => {
  const ppt = Buffer.alloc(512);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(ppt);
  const oldFormat = validatePresentationSourceBytes("cours.ppt", ppt);
  assert.equal(oldFormat.valid, false);
  if (!oldFormat.valid) assert.match(oldFormat.message, /réenregistré en \.pptx/i);

  const pptx = createStoredZip([
    { name: "[Content_Types].xml", content: CONTENT_TYPES_XML },
    { name: "ppt/presentation.xml", content: PRESENTATION_XML },
  ]);
  assert.deepEqual(validatePresentationSourceBytes("cours.pptx", pptx), { valid: true });
  assert.equal(validatePresentationSourceBytes("faux.pptx", Buffer.from("PK faux")).valid, false);
});

test("la validation PPTX refuse traversée, structure absente et zip bomb déclarée", () => {
  const traversal = createStoredZip([
    { name: "[Content_Types].xml", content: CONTENT_TYPES_XML },
    { name: "ppt/presentation.xml", content: PRESENTATION_XML },
    { name: "ppt/../../attaque", content: "x" },
  ]);
  assert.equal(validatePresentationSourceBytes("cours.pptx", traversal).valid, false);

  const missing = createStoredZip([{ name: "document.xml", content: "<document/>" }]);
  assert.equal(validatePresentationSourceBytes("cours.pptx", missing).valid, false);

  const bomb = createStoredZip([
    {
      name: "[Content_Types].xml",
      content: CONTENT_TYPES_XML,
      declaredUncompressedSize: 900_000_000,
    },
    { name: "ppt/presentation.xml", content: PRESENTATION_XML },
  ]);
  assert.equal(validatePresentationSourceBytes("cours.pptx", bomb).valid, false);
});

test("le schéma et la migration couvrent diapos, hotspots et reprise", async () => {
  const [schema, migration] = await Promise.all([
    read("prisma/schema.prisma"),
    read("prisma/migrations/20260905160000_presentation_foundation/migration.sql"),
  ]);

  assert.match(schema, /enum LessonType \{[\s\S]*PRESENTATION/);
  assert.match(schema, /model Presentation \{/);
  assert.match(schema, /model PresentationSlide \{/);
  assert.match(schema, /model PresentationHotspot \{/);
  assert.match(schema, /model PresentationProgress \{/);
  assert.match(schema, /sourceKey\s+String/);
  assert.match(schema, /@@unique\(\[presentationId, userId\]\)/);
  assert.match(migration, /PresentationHotspot_bounds_check/);
  assert.match(migration, /PresentationHotspot_destination_check/);
  assert.match(migration, /ON DELETE CASCADE/);
});

test("le téléversement vérifie le rôle, la propriété, la clé et le blob réel", async () => {
  const [route, actions, publicUploads] = await Promise.all([
    read("src/app/api/upload/lesson-presentation/route.ts"),
    read("src/server/actions/curriculum.ts"),
    read("src/app/uploads/[...path]/route.ts"),
  ]);

  assert.match(route, /requireLessonOwnership\(lessonId\)/);
  assert.match(route, /ownership\.lesson\.type !== "PRESENTATION"/);
  assert.match(route, /presentationSourcePrefix\(ownership\.userId, lessonId\)/);
  assert.match(route, /sourceKey: upload\.key/);
  assert.match(route, /createPrivatePresignedUpload/);
  assert.match(route, /!isPrivateR2Configured\(\)/);
  assert.match(actions, /lesson\.type !== "PRESENTATION"/);
  assert.match(actions, /presentationSourceKeyBelongsTo/);
  assert.match(actions, /getPrivateObjectSize/);
  assert.match(actions, /validatePresentationSourceBytes/);
  assert.match(actions, /deletePrivateObject\(parsed\.data\.sourceKey\)/);
  assert.match(actions, /storedSize !== parsed\.data\.sourceSizeBytes/);
  assert.match(publicUploads, /segments\[0\] === PRESENTATION_PREFIX/);
});

test("la route blob impose limite et destination signées pendant le streaming", async () => {
  const [local, privateLocal, blobRoute, presentationRoute] = await Promise.all([
    read("src/lib/storage/local.ts"),
    read("src/lib/storage/private-local.ts"),
    read("src/app/api/upload/blob/route.ts"),
    read("src/app/api/upload/lesson-presentation/route.ts"),
  ]);
  assert.match(local, /scope=public/);
  assert.match(privateLocal, /scope=private/);
  assert.match(blobRoute, /verifyUploadToken\(key, exp, token, maxSizeBytes, scope\)/);
  assert.match(blobRoute, /resolvePrivateLocalUploadPath/);
  assert.match(blobRoute, /declaredLength > maxSizeBytes/);
  assert.match(blobRoute, /total > maxSizeBytes/);
  assert.match(presentationRoute, /createPrivateLocalUpload/);
  assert.match(presentationRoute, /maxSizeBytes: sizeBytes/);
});

test("les formulaires et la page formateur exposent le type et ses états réels", async () => {
  const [createForm, editForm, page, manager] = await Promise.all([
    read("src/components/features/instructor/lesson-create-form.tsx"),
    read("src/components/features/instructor/lesson-edit-form.tsx"),
    read("src/app/formateur/cours/[id]/lecons/[lessonId]/page.tsx"),
    read("src/components/features/instructor/lesson-presentation-manager.tsx"),
  ]);

  assert.match(createForm, /value="PRESENTATION"/);
  assert.match(editForm, /value="PRESENTATION"/);
  assert.match(page, /<LessonPresentationManager/);
  assert.match(manager, /UPLOADED/);
  assert.match(manager, /PROCESSING/);
  assert.match(manager, /READY/);
  assert.match(manager, /ERROR/);
  assert.match(manager, /en attente du service de conversion/i);
  assert.doesNotMatch(manager, /lecteur apprenant sera activé séparément/i);
  assert.match(
    manager,
    /le diaporama devient automatiquement disponible dans le lecteur apprenant/i,
  );
  assert.match(manager, /presentation\?\.status !== "UPLOADED"/);
  assert.match(manager, /presentation\?\.status !== "PROCESSING"/);
  assert.match(manager, /window\.setInterval/);
  assert.match(manager, /5_000/);
  assert.match(manager, /refreshCount >= 24/);
  assert.match(manager, /window\.clearInterval/);
  assert.doesNotMatch(manager, /href=.*sourceKey/);
});

test("un fichier privé préexistant reste hors de public et de /uploads", async () => {
  const testRoot = path.join(os.tmpdir(), `eformation-private-test-${process.pid}`);
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    PRIVATE_UPLOAD_ROOT: testRoot,
  };
  const privateFile = resolvePrivateStoredFilePath(
    "presentations/source/u/l/cours.pptx",
    environment,
  );
  assert.ok(privateFile);
  await mkdir(path.dirname(privateFile), { recursive: true });
  await writeFile(privateFile, "private-before-start");

  try {
    const publicRoot = path.resolve(root, "public", "uploads");
    assert.equal(privateUploadRoot(environment), path.resolve(testRoot));
    assert.equal(privateUploadRoot({ NODE_ENV: "production" }), "/app/private-uploads");
    assert.equal(
      privateUploadRoot({ NODE_ENV: "test" }).startsWith(`${publicRoot}${path.sep}`),
      false,
    );
    assert.throws(
      () =>
        privateUploadRoot({
          NODE_ENV: "test",
          PRIVATE_UPLOAD_ROOT: path.join(root, "public", "private"),
        }),
      /hors du dossier public/,
    );
    assert.equal(privateFile.startsWith(`${publicRoot}${path.sep}`), false);
    assert.equal(await readFile(privateFile, "utf8"), "private-before-start");

    const [publicRoute, nextConfig] = await Promise.all([
      read("src/app/uploads/[...path]/route.ts"),
      read("next.config.ts"),
    ]);
    assert.match(publicRoute, /segments\[0\] === PRESENTATION_PREFIX/);
    assert.match(publicRoute, /resolveLocalStoredFilePath\(segments\)/);
    assert.doesNotMatch(publicRoute, /resolvePrivateStoredFilePath/);
    assert.doesNotMatch(nextConfig, /outputFileTracingExcludes/);
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});
