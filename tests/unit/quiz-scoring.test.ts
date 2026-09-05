import assert from "node:assert/strict";
import test from "node:test";

import { isQuizAnswerCorrect } from "../../src/lib/quiz-scoring";

test("corrige exactement toutes les cartes d'un classement", () => {
  const question = {
    kind: "DRAG_DROP",
    answerConfig: null,
    options: [
      { id: "temperature", isCorrect: false, targetId: "rebond" },
      { id: "regulation", isCorrect: false, targetId: "chauffage" },
    ],
  };
  assert.equal(isQuizAnswerCorrect(question, { optionIds: [], placements: [
    { optionId: "temperature", targetId: "rebond" },
    { optionId: "regulation", targetId: "chauffage" },
  ] }), true);
  assert.equal(isQuizAnswerCorrect(question, { optionIds: [], placements: [
    { optionId: "temperature", targetId: "chauffage" },
    { optionId: "regulation", targetId: "rebond" },
  ] }), false);
});

test("corrige le clic selon le rayon défini par le formateur", () => {
  const question = { kind: "HOTSPOT", answerConfig: { x: 50, y: 50, radius: 10 }, options: [] };
  assert.equal(isQuizAnswerCorrect(question, { optionIds: [], point: { x: 56, y: 56 } }), true);
  assert.equal(isQuizAnswerCorrect(question, { optionIds: [], point: { x: 70, y: 50 } }), false);
});
