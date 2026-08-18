import assert from "node:assert/strict";
import test from "node:test";
import { computeQuizResultMetrics } from "../../src/lib/quiz-results";

test("calcule la réussite par élève et quiz, sans doubler un échec suivi d’une réussite", () => {
  assert.deepEqual(computeQuizResultMetrics(3, [
    { id: "q1", attempts: [{ userId: "u1", score: 80, passed: true }, { userId: "u1", score: 60, passed: false }] },
    { id: "q2", attempts: [{ userId: "u2", score: 100, passed: true }] },
  ]), {
    enrollmentCount: 3, attemptCount: 3, learnersStarted: 2,
    passRate: 100, averageScore: 80, notStartedCount: 4,
  });
});

test("un élève reste échoué seulement lorsqu’aucune de ses tentatives ne réussit", () => {
  const result = computeQuizResultMetrics(2, [{ id: "q1", attempts: [
    { userId: "u1", score: 20, passed: false },
    { userId: "u1", score: 40, passed: false },
    { userId: "u2", score: 30, passed: false },
  ] }]);
  assert.equal(result.passRate, 0);
  assert.equal(result.attemptCount, 3);
  assert.equal(result.notStartedCount, 0);
});

test("retourne des taux nuls sans tentative", () => {
  const result = computeQuizResultMetrics(2, [{ id: "q1", attempts: [] }]);
  assert.equal(result.passRate, 0);
  assert.equal(result.averageScore, 0);
  assert.equal(result.notStartedCount, 2);
});
