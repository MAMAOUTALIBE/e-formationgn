import assert from "node:assert/strict";
import test from "node:test";

import { validateQuizSubmission } from "../../src/lib/quiz-submission";

const questions = [
  {
    id: "single",
    kind: "SINGLE_CHOICE" as const,
    options: [{ id: "s1" }, { id: "s2" }],
  },
  {
    id: "multiple",
    kind: "MULTIPLE_CHOICE" as const,
    options: [{ id: "m1" }, { id: "m2" }, { id: "m3" }],
  },
  {
    id: "boolean",
    kind: "TRUE_FALSE" as const,
    options: [{ id: "true" }, { id: "false" }],
  },
];

const validAnswers = [
  { questionId: "single", optionIds: ["s1"] },
  { questionId: "multiple", optionIds: ["m1", "m2"] },
  { questionId: "boolean", optionIds: ["true"] },
];

test("accepte une soumission complète dont les cardinalités sont valides", () => {
  assert.deepEqual(validateQuizSubmission(questions, validAnswers), { valid: true });
});

test("refuse les questions manquantes, supplémentaires et dupliquées", () => {
  assert.equal(validateQuizSubmission(questions, validAnswers.slice(0, 2)).valid, false);
  assert.equal(
    validateQuizSubmission(questions, [
      ...validAnswers,
      { questionId: "extra", optionIds: ["x"] },
    ]).valid,
    false,
  );
  assert.equal(
    validateQuizSubmission(questions, [validAnswers[0]!, validAnswers[0]!, validAnswers[2]!]).valid,
    false,
  );
});

test("refuse les options dupliquées ou appartenant à une autre question", () => {
  assert.equal(
    validateQuizSubmission(questions, [
      validAnswers[0]!,
      { questionId: "multiple", optionIds: ["m1", "m1"] },
      validAnswers[2]!,
    ]).valid,
    false,
  );
  assert.equal(
    validateQuizSubmission(questions, [
      { questionId: "single", optionIds: ["m1"] },
      validAnswers[1]!,
      validAnswers[2]!,
    ]).valid,
    false,
  );
});

test("impose exactement une option aux choix simples et au vrai/faux", () => {
  for (const optionIds of [[], ["s1", "s2"]]) {
    assert.equal(
      validateQuizSubmission(questions, [
        { questionId: "single", optionIds },
        validAnswers[1]!,
        validAnswers[2]!,
      ]).valid,
      false,
    );
  }
  assert.equal(
    validateQuizSubmission(questions, [
      validAnswers[0]!,
      validAnswers[1]!,
      { questionId: "boolean", optionIds: ["true", "false"] },
    ]).valid,
    false,
  );
});

test("impose au moins une option au choix multiple", () => {
  assert.equal(
    validateQuizSubmission(questions, [
      validAnswers[0]!,
      { questionId: "multiple", optionIds: [] },
      validAnswers[2]!,
    ]).valid,
    false,
  );
});

test("valide un classement complet et refuse une cible inconnue", () => {
  const dragQuestion = [{
    id: "drag",
    kind: "DRAG_DROP" as const,
    interactionConfig: { targets: [{ id: "rebond", label: "Effet rebond" }, { id: "chauffage", label: "Chauffage" }] },
    options: [{ id: "carte-1" }, { id: "carte-2" }],
  }];
  assert.deepEqual(validateQuizSubmission(dragQuestion, [{
    questionId: "drag", optionIds: [], placements: [
      { optionId: "carte-1", targetId: "rebond" },
      { optionId: "carte-2", targetId: "chauffage" },
    ],
  }]), { valid: true });
  assert.equal(validateQuizSubmission(dragQuestion, [{
    questionId: "drag", optionIds: [], placements: [
      { optionId: "carte-1", targetId: "inconnue" },
      { optionId: "carte-2", targetId: "chauffage" },
    ],
  }]).valid, false);
});

test("valide un clic dans l'image et refuse une réponse absente", () => {
  const hotspotQuestion = [{ id: "zone", kind: "HOTSPOT" as const, options: [] }];
  assert.deepEqual(validateQuizSubmission(hotspotQuestion, [{
    questionId: "zone", optionIds: [], point: { x: 42, y: 67 },
  }]), { valid: true });
  assert.equal(validateQuizSubmission(hotspotQuestion, [{ questionId: "zone", optionIds: [] }]).valid, false);
});
