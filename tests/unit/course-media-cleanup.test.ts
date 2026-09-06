import assert from "node:assert/strict";
import test from "node:test";

import { runCourseMediaCleanup, type CourseMediaCleanupDependencies } from "../../src/lib/domain/course-media-cleanup";
import { managedCourseObjectFromUrl } from "../../src/lib/storage/course-media-provenance";

const owner = "user-123";
const filename = "1720000000000-ab12cd34-support.pdf";
const resourceKey = `resources/lessons/${owner}/${filename}`;
const thumbnailKey = `thumbnails/courses/${owner}/1720000000000-ab12cd34-image.png`;
const heroBackgroundKey = `hero-backgrounds/courses/${owner}/1720000000000-ab12cd34-hero.webp`;
const config = { r2AccountId: "account", r2Bucket: "bucket", r2PublicUrl: "https://media.example.com/assets" };

test("reconnaît strictement les objets locaux et R2 custom/native générés pour le propriétaire", () => {
  assert.deepEqual(managedCourseObjectFromUrl(`/uploads/${resourceKey}`, owner, config), { backend: "local", key: resourceKey });
  assert.deepEqual(managedCourseObjectFromUrl(`https://media.example.com/assets/${thumbnailKey}`, owner, config), { backend: "r2", key: thumbnailKey });
  assert.deepEqual(managedCourseObjectFromUrl(`/uploads/${heroBackgroundKey}`, owner, config), { backend: "local", key: heroBackgroundKey });
  assert.deepEqual(managedCourseObjectFromUrl(`https://account.r2.cloudflarestorage.com/bucket/${resourceKey}`, owner, { r2AccountId: "account", r2Bucket: "bucket" }), { backend: "r2", key: resourceKey });
  const virtualClassKey = `resources/virtual-classes/${owner}/${filename}`;
  assert.deepEqual(managedCourseObjectFromUrl(`/uploads/${virtualClassKey}`, owner, config), { backend: "local", key: virtualClassKey });
});

test("refuse URL externe, type inconnu, autre propriétaire et traversals", () => {
  const rejected = [
    "https://youtube.com/watch?v=abc",
    `https://media.example.com/assets/avatars/${owner}/${filename}`,
    `https://media.example.com/assets/resources/lessons/other/${filename}`,
    `/uploads/resources/lessons/${owner}/../${filename}`,
    `/uploads/resources/lessons/${owner}/%2e%2e%2f${filename}`,
    `/uploads/resources/lessons/${owner}/%252e%252e%252f${filename}`,
    `https://evil.example/resources/virtual-classes/${owner}/${filename}`,
  ];
  for (const url of rejected) assert.equal(managedCourseObjectFromUrl(url, owner, config), null, url);
});

function cleanupHarness(overrides: Partial<CourseMediaCleanupDependencies> = {}) {
  const deleted: string[] = [];
  const warnings: string[] = [];
  const deps: CourseMediaCleanupDependencies = {
    config,
    referencedUrls: async () => new Set(),
    deleteMux: async (id) => { deleted.push(`mux:${id}`); return true; },
    deleteLocal: async (key) => { deleted.push(`local:${key}`); },
    deleteR2: async (key) => { deleted.push(`r2:${key}`); },
    deletePrivate: async (key) => { deleted.push(`private:${key}`); },
    deletePrivatePrefix: async (prefix) => { deleted.push(`private-prefix:${prefix}`); },
    warn: (message) => { warnings.push(message); },
    ...overrides,
  };
  return { deps, deleted, warnings };
}

test("supprime les objets possédés, mais conserve URL externe et objet partagé", async () => {
  const shared = `/uploads/${thumbnailKey}`;
  const { deps, deleted, warnings } = cleanupHarness({ referencedUrls: async () => new Set([shared]) });
  await runCourseMediaCleanup({ ownerId: owner, muxAssetIds: ["mux-1"], storedUrls: [
    `/uploads/${resourceKey}`, `https://media.example.com/assets/${thumbnailKey}`, shared, "https://cdn.example.net/file.mp4",
  ] }, deps);
  assert.deepEqual(deleted, [`mux:mux-1`, `local:${resourceKey}`, `r2:${thumbnailKey}`]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /provenance/i);
});

test("les erreurs unlink, R2 et Mux sont best-effort et journalisées", async () => {
  const { deps, warnings } = cleanupHarness({
    deleteMux: async () => { throw new Error("mux down"); },
    deleteLocal: async () => { throw new Error("unlink denied"); },
    deleteR2: async () => { throw new Error("r2 down"); },
  });
  await assert.doesNotReject(() => runCourseMediaCleanup({ ownerId: owner, muxAssetIds: ["mux-1"], storedUrls: [
    `/uploads/${resourceKey}`, `https://media.example.com/assets/${thumbnailKey}`,
  ] }, deps));
  assert.equal(warnings.length, 3);
  assert.match(warnings.join(" "), /Mux.*Nettoyage.*Nettoyage/);
});

test("un refus best-effort Mux est journalisé sans bloquer les autres nettoyages", async () => {
  const { deps, deleted, warnings } = cleanupHarness({ deleteMux: async () => false });
  await runCourseMediaCleanup({ ownerId: owner, muxAssetIds: ["mux-1"], storedUrls: [`/uploads/${resourceKey}`] }, deps);
  assert.deepEqual(deleted, [`local:${resourceKey}`]);
  assert.deepEqual(warnings, ["Asset Mux non supprimé"]);
});

test("les sources et rendus privés d'un cours sont nettoyés", async () => {
  const { deps, deleted } = cleanupHarness();
  await runCourseMediaCleanup(
    {
      ownerId: owner,
      muxAssetIds: [],
      storedUrls: [],
      privateKeys: ["presentations/source/u/l/source.pptx", "rendered/slide.png"],
      privatePrefixes: ["presentations/rendered/p/token"],
    },
    deps,
  );
  assert.deepEqual(deleted, [
    "private:presentations/source/u/l/source.pptx",
    "private:rendered/slide.png",
    "private-prefix:presentations/rendered/p/token",
  ]);
});
