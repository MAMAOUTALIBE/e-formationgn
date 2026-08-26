import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { canCompleteYouTube, isYouTubeEndedState, normalizeLessonVideoUrl, observeYouTubePlayback, parseYouTubeUrl, youtubePlayerErrorMessage, youtubeWatchUrl } from "../../src/lib/youtube";

const id = "dQw4w9WgXcQ";
for (const url of [
  `https://www.youtube.com/watch?v=${id}&t=10`, `https://youtu.be/${id}`,
  `https://youtube.com/shorts/${id}`, `https://www.youtube.com/embed/${id}`,
  `https://www.youtube-nocookie.com/embed/${id}`,
  // Formes rencontrées dans les liens collés par les formateurs : slash final,
  // ancien `/v/`, page « en direct », et espaces autour du collage.
  `https://www.youtube.com/watch/?v=${id}`, `https://www.youtube.com/v/${id}`,
  `https://www.youtube.com/live/${id}`, `  https://youtu.be/${id}  `,
  `https://m.youtube.com/watch?v=${id}`,
]) {
  test(`reconnaît et normalise ${url}`, () => {
    assert.deepEqual(parseYouTubeUrl(url), { id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}` });
  });
}

test("refuse identifiants, hôtes, chemins et protocoles non stricts", () => {
  for (const url of [
    "https://youtube.com/watch?v=short", `https://evil.youtube.com/watch?v=${id}`,
    `https://youtube.com/channel/${id}`, `https://youtu.be/${id}/extra`,
    `javascript:https://youtube.com/watch?v=${id}`,
  ]) assert.equal(parseYouTubeUrl(url), null, url);
});

test("la normalisation serveur conserve les fichiers directs et explique YouTube invalide", () => {
  assert.deepEqual(normalizeLessonVideoUrl("/uploads/lessons/a/video.mp4"), { success: true, url: "/uploads/lessons/a/video.mp4" });
  assert.deepEqual(normalizeLessonVideoUrl("https://cdn.example.com/video.webm"), { success: true, url: "https://cdn.example.com/video.webm" });
  const invalid = normalizeLessonVideoUrl("https://youtube.com/watch?v=bad");
  assert.equal(invalid.success, false);
  if (!invalid.success) assert.match(invalid.message, /YouTube invalide/i);
});

test("le cumul compte la lecture continue mais ignore les seeks avant/arrière", () => {
  let state = { watchedSeconds: 10, lastPosition: null as number | null };
  for (const position of [20, 21, 22, 23]) state = observeYouTubePlayback(state, position);
  assert.equal(state.watchedSeconds, 13);
  state = observeYouTubePlayback(state, 99); // seek fin
  assert.equal(state.watchedSeconds, 13);
  state = observeYouTubePlayback(state, 5); // replay / seek arrière
  assert.equal(state.watchedSeconds, 13);
  state = observeYouTubePlayback(state, 6);
  assert.equal(state.watchedSeconds, 14);
});

test("le cumul ignore l'onglet masqué et reprend sur une nouvelle baseline", () => {
  let state = { watchedSeconds: 90, lastPosition: 90 as number | null };
  state = observeYouTubePlayback(state, 91, true);
  assert.equal(state.watchedSeconds, 91);
  state = observeYouTubePlayback(state, 97, false);
  assert.deepEqual(state, { watchedSeconds: 91, lastPosition: null });
  state = observeYouTubePlayback(state, 98, true); // baseline au retour visible
  assert.equal(state.watchedSeconds, 91);
  state = observeYouTubePlayback(state, 99, true);
  assert.equal(state.watchedSeconds, 92);
  assert.equal(canCompleteYouTube({ ended: true, watchedSeconds: state.watchedSeconds, durationSeconds: 100, alreadyCompleted: false }), false);
});

test("ENDED exige 95 % réellement observés et reste idempotent", () => {
  assert.equal(canCompleteYouTube({ ended: true, watchedSeconds: 5, durationSeconds: 100, alreadyCompleted: false }), false); // seek fin
  assert.equal(canCompleteYouTube({ ended: true, watchedSeconds: 90, durationSeconds: 100, alreadyCompleted: false }), false); // reprise proche fin
  assert.equal(canCompleteYouTube({ ended: false, watchedSeconds: 100, durationSeconds: 100, alreadyCompleted: false }), false);
  assert.equal(canCompleteYouTube({ ended: true, watchedSeconds: 95, durationSeconds: 100, alreadyCompleted: false }), true);
  assert.equal(canCompleteYouTube({ ended: true, watchedSeconds: 150, durationSeconds: 100, alreadyCompleted: true }), false); // replay / ENDED multiple
});

test("seul l'état ENDED complète et les erreurs privées/embed sont compréhensibles", () => {
  assert.equal(isYouTubeEndedState(0), true);
  for (const state of [-1, 1, 2, 3, 5]) assert.equal(isYouTubeEndedState(state), false);
  assert.match(youtubePlayerErrorMessage(100), /privée|supprimée/);
  assert.match(youtubePlayerErrorMessage(150), /interdit/);
});

test("intégration lecteur, heartbeat, reprise, preview et CSP sont raccordés", () => {
  const player = readFileSync("src/components/features/learning/lesson-player.tsx", "utf8");
  const preview = readFileSync("src/components/features/instructor/lesson-video-source.tsx", "utf8");
  const csp = readFileSync("next.config.ts", "utf8");
  assert.match(player, /useLearningHeartbeat\(lessonId, \{ mode: "VIDEO", isPlaying \}\)/);
  assert.match(player, /seekTo\(initialPositionSeconds, true\)/);
  assert.match(player, /isYouTubeEndedState\(data\)/);
  assert.match(player, /initialWatchedSeconds=\{initialWatchedSeconds\}/);
  assert.match(player, /watchedSeconds: Math\.round\(playedSecondsRef\.current\), lastPositionSeconds: Math\.round\(current\)/);
  assert.match(player, /youtubeApiPromise = null/);
  assert.match(player, /10_000/);
  assert.match(player, /addEventListener\("error"/);
  assert.match(player, /document\.visibilityState === "visible"/);
  assert.match(player, /restoreReadyCallback\(\)/);
  assert.match(player, /www\.youtube-nocookie\.com/);
  assert.match(preview, /Aperçu de la vidéo YouTube/);
  assert.match(csp, /frame-src[^\n]+youtube-nocookie\.com/);
  assert.match(csp, /script-src[^\n]+www\.youtube\.com/);
});

test("le lien de repli pointe la vidéo sur youtube.com", () => {
  assert.equal(youtubeWatchUrl(id), `https://www.youtube.com/watch?v=${id}`);
});

test("l'élargissement des formats ne relâche pas la validation", () => {
  for (const url of [
    // `/live` et `/v` n'échappent pas au contrôle d'identifiant ni d'hôte.
    "https://www.youtube.com/live/tropcourt", `https://evil.com/embed/${id}`,
    `https://www.youtube.com/watch/${id}`, // /watch porte l'id en query, pas en chemin
    `http://www.youtube.com/watch?v=${id}`, // http refusé, l'embed est servi en https
    `https://www.youtube.com/embed/${id}/extra`,
  ]) assert.equal(parseYouTubeUrl(url), null, url);
});

test("le lecteur retombe sur une <iframe> quand l'API JS est indisponible", () => {
  // CSP, extension de blocage ou réseau coupé : la vidéo doit rester
  // regardable, seul le suivi automatique de progression est perdu.
  const player = readFileSync("src/components/features/learning/lesson-player.tsx", "utf8");
  assert.match(player, /setApiUnavailable\(true\)/);
  assert.match(player, /apiUnavailable \? \(/);
  assert.match(player, /<iframe/);
  assert.match(player, /allowFullScreen/);
  assert.match(player, /Lecture simplifiée/);
  // L'API REMPLACE le nœud qu'on lui confie : il ne doit jamais s'agir d'un
  // nœud rendu par React, sinon React pilote un élément détaché.
  assert.match(player, /document\.createElement\("div"\)/);
  assert.match(player, /container\.appendChild\(host\)/);
  assert.match(player, /container\?\.replaceChildren\(\)/);
});

test("la CSP autorise les deux origines dont dépend l'API IFrame", () => {
  // `iframe_api` n'est qu'un chargeur : il injecte `www-widgetapi.js`, servi
  // selon les régions depuis www.youtube.com OU s.ytimg.com. La politique
  // étant désormais APPLIQUÉE, une origine manquante laisse le lecteur noir.
  const csp = readFileSync("next.config.ts", "utf8");
  const script = csp.match(/`script-src[^`]+`/)?.[0] ?? "";
  const frame = csp.match(/"frame-src[^"]+"/)?.[0] ?? "";
  assert.match(script, /https:\/\/www\.youtube\.com/);
  assert.match(script, /https:\/\/s\.ytimg\.com/);
  assert.match(frame, /https:\/\/www\.youtube-nocookie\.com/);
  assert.match(frame, /https:\/\/www\.youtube\.com/);
});
