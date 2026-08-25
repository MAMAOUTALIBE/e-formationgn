import assert from "node:assert/strict";
import test from "node:test";

import { installYouTubeReadyCallback } from "../../src/lib/youtube-api-ready";

test("le callback YouTube existant est chaîné puis restauré", () => {
  const calls: string[] = [];
  const previous = () => calls.push("previous");
  const scope = { onYouTubeIframeAPIReady: previous };
  const restore = installYouTubeReadyCallback(scope, () => calls.push("ready"));
  scope.onYouTubeIframeAPIReady();
  assert.deepEqual(calls, ["previous", "ready"]);
  restore();
  assert.equal(scope.onYouTubeIframeAPIReady, previous);
});

test("la restauration préserve un callback installé entre-temps", () => {
  const scope: { onYouTubeIframeAPIReady?: () => void } = {};
  const restore = installYouTubeReadyCallback(scope, () => undefined);
  const replacement = () => undefined;
  scope.onYouTubeIframeAPIReady = replacement;
  restore();
  assert.equal(scope.onYouTubeIframeAPIReady, replacement);
});

test("le callback nouveau s'exécute même si l'ancien lève une erreur", () => {
  let ready = false;
  const scope = { onYouTubeIframeAPIReady: () => { throw new Error("ancien callback"); } };
  installYouTubeReadyCallback(scope, () => { ready = true; });
  assert.throws(() => scope.onYouTubeIframeAPIReady(), /ancien callback/);
  assert.equal(ready, true);
});
