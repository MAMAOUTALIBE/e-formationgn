import assert from "node:assert/strict";
import test from "node:test";

import {
  isLikelyVideoFile,
  videoUploadContentType,
} from "../../src/lib/video-file";

test("accepte les MIME vidéo standards", () => {
  assert.equal(isLikelyVideoFile("cours.bin", "video/custom"), true);
});

test("accepte les formats vidéo dont le navigateur omet le MIME", () => {
  assert.equal(isLikelyVideoFile("cours.MKV", ""), true);
  assert.equal(isLikelyVideoFile("capture.mxf", "application/octet-stream"), true);
  assert.equal(isLikelyVideoFile("camera.MTS", "application/octet-stream"), true);
});

test("refuse un fichier qui n'est pas identifiable comme vidéo", () => {
  assert.equal(isLikelyVideoFile("archive.zip", "application/zip"), false);
});

test("normalise le MIME des formats mal reconnus", () => {
  assert.equal(videoUploadContentType("cours.mkv", ""), "video/x-matroska");
  assert.equal(videoUploadContentType("cours.MTS", "application/octet-stream"), "video/mp2t");
});
