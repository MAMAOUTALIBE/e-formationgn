import assert from "node:assert/strict";
import test from "node:test";

import { hasPersistentMediaReference, resolvePersistentMediaReferences, structuredValueContainsUrl } from "../../src/lib/domain/persistent-media-reference";

const miniature = "/uploads/thumbnails/courses/user-1/1720000000000-ab12cd34-mini.png";

test("une miniature réutilisée comme avatar est conservée", () => {
  assert.equal(hasPersistentMediaReference({ counts: { users: 1, courses: 0 }, structuredDocuments: [] }, miniature), true);
});

test("les références certificat, CMS et autres modèles URL sont conservées", () => {
  for (const field of ["orders", "certificates", "banners", "cmsPages", "emailBodies"]) {
    assert.equal(hasPersistentMediaReference({ counts: { [field]: 1 }, structuredDocuments: [] }, miniature), true, field);
  }
});

test("les pièces jointes et variables JSON imbriquées sont détectées par égalité exacte", () => {
  const document = { files: [{ url: miniature, name: "miniature" }] };
  assert.equal(structuredValueContainsUrl(document, miniature), true);
  assert.equal(hasPersistentMediaReference({ counts: {}, structuredDocuments: [document] }, miniature), true);
  assert.equal(structuredValueContainsUrl({ note: `voir ${miniature}` }, miniature), false);
});

test("une URL absente de tous les modèles est considérée orpheline", () => {
  assert.equal(hasPersistentMediaReference({ counts: { users: 0, courses: 0, certificates: 0 }, structuredDocuments: [{ url: "other" }] }, miniature), false);
});

test("la résolution batch raccorde avatar, certificat, CMS, email, ticket et notification", async () => {
  const candidates = ["avatar", "certificat", "cms", "email", "ticket", "notification", "orphelin"];
  let calls = 0;
  const referenced = await resolvePersistentMediaReferences(candidates, {
    scalarUrls: async () => { calls++; return ["avatar", "certificat", "notification"]; },
    embeddedTexts: async () => { calls++; return ["page cms", "email intégré", "pièce ticket"]; },
    hasUnfilterableStructuredMedia: async () => { calls++; return false; },
  });
  assert.deepEqual([...referenced].sort(), ["avatar", "certificat", "cms", "email", "notification", "ticket"]);
  assert.equal(calls, 3);
});

test("le plafond de lectures reste constant quel que soit le nombre de médias", async () => {
  for (const size of [1, 100]) {
    let calls = 0;
    const reader = {
      scalarUrls: async () => { calls++; return []; },
      embeddedTexts: async () => { calls++; return []; },
      hasUnfilterableStructuredMedia: async () => { calls++; return false; },
    };
    await resolvePersistentMediaReferences(Array.from({ length: size }, (_, index) => `url-${index}`), reader);
    assert.equal(calls, 3);
  }
});

test("la présence de JSON non filtrable conserve tous les candidats sans full scan", async () => {
  const referenced = await resolvePersistentMediaReferences(["a", "b"], {
    scalarUrls: async () => [], embeddedTexts: async () => [], hasUnfilterableStructuredMedia: async () => true,
  });
  assert.deepEqual([...referenced], ["a", "b"]);
});
