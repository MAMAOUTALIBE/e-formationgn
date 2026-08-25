import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { mergeLessonVideoMetrics } from "../../src/lib/lesson-video-progress";

test("une requête tardive ne régresse pas le cumul mais devient la position courante", () => {
  const recent = { watchedSeconds: 80, lastPositionSeconds: 75 };
  assert.deepEqual(mergeLessonVideoMetrics(recent, { watchedSeconds: 30, lastPositionSeconds: 20 }), {
    watchedSeconds: 80,
    lastPositionSeconds: 20,
  });
});

test("seek arrière et fin de vidéo peuvent mettre à jour ou remettre à zéro la position", () => {
  const existing = { watchedSeconds: 80, lastPositionSeconds: 75 };
  assert.deepEqual(mergeLessonVideoMetrics(existing, { watchedSeconds: 90, lastPositionSeconds: 10 }), {
    watchedSeconds: 90,
    lastPositionSeconds: 10,
  });
  assert.deepEqual(mergeLessonVideoMetrics(existing, { lastPositionSeconds: 0 }), {
    watchedSeconds: 80,
    lastPositionSeconds: 0,
  });
});

test("la persistance sérialise et réessaie les conflits concurrents", () => {
  const service = readFileSync("src/server/services/lesson-completion.ts", "utf8");
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(service, /error\.code !== "P2034"/);
  assert.match(service, /attempt >= 2/);
  assert.match(service, /mergeLessonVideoMetrics\(existing, input\)/);
  assert.match(service, /Inscrivez-vous à la formation/);
});

test("Mux, vidéo native et YouTube remettent la reprise à zéro sur ENDED", () => {
  const player = readFileSync("src/components/features/learning/lesson-player.tsx", "utf8");
  assert.equal(player.match(/lastPositionSeconds: 0/g)?.length, 4);
  assert.match(player, /isYouTubeEndedState\(data\)/);
  assert.match(player, /addEventListener\("ended", handleEnded\)/);
});
