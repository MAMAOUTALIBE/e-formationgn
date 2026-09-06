import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  isPresentationComplete,
  mergeViewedSlideOrders,
  presentationHotspotLabel,
  presentationSlideIndexForResume,
} from "../../src/lib/presentation-learning";

const root = process.cwd();
const read = (relativePath: string) => readFile(path.join(root, relativePath), "utf8");

test("la reprise utilise un ordre serveur existant et revient sinon au début", () => {
  assert.equal(presentationSlideIndexForResume([0, 2, 4], 2), 1);
  assert.equal(presentationSlideIndexForResume([0, 2, 4], 3), 0);
  assert.equal(presentationSlideIndexForResume([0, 2, 4], null), 0);
});

test("les visites sont fusionnées sans doublon et sans écraser l'historique", () => {
  assert.deepEqual(mergeViewedSlideOrders([4, 0, 2], 3), [0, 2, 3, 4]);
  assert.deepEqual(mergeViewedSlideOrders([0, 1], 1), [0, 1]);
  const aprèsDeuxRapports = mergeViewedSlideOrders(
    mergeViewedSlideOrders([0], 2),
    1,
  );
  assert.deepEqual(aprèsDeuxRapports, [0, 1, 2]);
});

test("la complétion exige 90 % des slides valides et la dernière slide", () => {
  const slideOrders = Array.from({ length: 10 }, (_, index) => index);
  assert.equal(
    isPresentationComplete({
      slideOrders,
      viewedSlideOrders: slideOrders.slice(0, 9),
      currentSlideOrder: 8,
    }),
    false,
  );
  assert.equal(
    isPresentationComplete({
      slideOrders,
      viewedSlideOrders: [0, 1, 2, 3, 4, 5, 6, 7, 9],
      currentSlideOrder: 9,
    }),
    true,
  );
  assert.equal(
    isPresentationComplete({
      slideOrders,
      viewedSlideOrders: [0, 1, 2, 3, 4, 5, 6, 7, 9],
      currentSlideOrder: 7,
    }),
    false,
  );
});

test("les hotspots ont toujours un libellé accessible", () => {
  assert.equal(
    presentationHotspotLabel({
      ariaLabel: null,
      kind: "INTERNAL_SLIDE",
      externalUrl: null,
      targetSlideOrder: 2,
    }),
    "Aller à la diapositive 3",
  );
  assert.equal(
    presentationHotspotLabel({
      ariaLabel: "Documentation",
      kind: "EXTERNAL_URL",
      externalUrl: "https://example.org/guide",
      targetSlideOrder: null,
    }),
    "Documentation",
  );
});

test("la DAL est à sélection positive et ne sérialise aucune clé privée", async () => {
  const source = await read("src/server/queries/presentation-learning.ts");
  assert.doesNotMatch(source, /\bimageKey\b/);
  assert.doesNotMatch(source, /\bsourceKey\b/);
  assert.match(source, /status: "READY"/);
  assert.match(source, /enrollments: \{ some: \{ userId \} \}/);
  assert.match(source, /orderBy: \{ displayOrder: "asc" \}/);
  assert.match(source, /safeExternalPresentationUrl/);
});

test("la progression revalide relation, inscription et ordres dans une transaction sérialisable", async () => {
  const [service, action] = await Promise.all([
    read("src/server/services/presentation-learning.ts"),
    read("src/server/actions/learning.ts"),
  ]);
  assert.match(service, /slides: \{ some: \{ id: input\.slideId \} \}/);
  assert.match(service, /userId_courseId/);
  assert.equal(
    (service.match(/Présentation indisponible\./g) ?? []).length,
    3,
    "les refus IDOR ne distinguent pas ressource absente et inscription absente",
  );
  assert.match(service, /actualSlide\.displayOrder/);
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(service, /error\.code === "P2034"/);
  assert.match(service, /mergeViewedSlideOrders/);
  assert.match(service, /isPresentationComplete/);
  assert.match(service, /markLessonCompleted\([\s\S]+tx/);
  assert.match(action, /presentationViewSchema\.safeParse/);
  assert.match(action, /session\.user\.id/);
});

test("la route PNG bloque l'IDOR, impose inline/no-store et ne propose aucun téléchargement", async () => {
  const source = await read(
    "src/app/api/lecons/[lessonId]/presentation/diapositives/[slideId]/route.ts",
  );
  assert.match(source, /presentation: \{ lessonId, status: "READY" \}/);
  assert.match(source, /course\.instructorId === session\.user\.id/);
  assert.match(source, /userId_courseId/);
  assert.match(source, /"Content-Disposition": "inline"/);
  assert.match(source, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.match(source, /"X-Content-Type-Options": "nosniff"/);
  assert.match(source, /export async function HEAD/);
  assert.doesNotMatch(source, /attachment|download/i);
});

test("le lecteur couvre navigation, mobile, plein écran et liens externes sûrs", async () => {
  const source = await read(
    "src/components/features/learning/lesson-presentation-player.tsx",
  );
  assert.match(source, /event\.key === "ArrowLeft"/);
  assert.match(source, /event\.key === "ArrowRight"/);
  assert.match(source, /onTouchStart=\{handleTouchStart\}/);
  assert.match(source, /Math\.abs\(deltaX\) < 50/);
  assert.match(source, /requestFullscreen/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /draggable=\{false\}/);
  assert.match(source, /onContextMenu/);
  assert.match(source, /role="progressbar"/);
  assert.match(source, /className="sr-only" aria-live="polite"/);
  assert.match(source, /Texte extrait de la diapositive/);
  assert.match(source, /data-presentation-canvas/);
  assert.match(source, /new ResizeObserver/);
  assert.match(source, /availableHeight \* ratio/);
  assert.match(source, /new Set\(\[\.\.\.current, \.\.\.progress\.viewedSlideOrders\]\)/);
  assert.match(source, /const prefetched = new Image\(\)/);
});
