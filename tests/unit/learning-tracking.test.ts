import assert from "node:assert/strict";
import test from "node:test";

import { computeHeartbeatCredit, derivePedagogicalStatus, shouldSendLearningHeartbeat } from "../../src/lib/learning-tracking";

test("heartbeat credits only a recent server interval", () => {
  const start = new Date("2026-08-18T10:00:00Z");
  assert.equal(computeHeartbeatCredit(start, new Date("2026-08-18T10:00:20Z")), 20);
  assert.equal(computeHeartbeatCredit(start, new Date("2026-08-18T10:00:46Z")), 45);
  assert.equal(computeHeartbeatCredit(start, new Date("2026-08-18T10:01:00Z")), 45);
  assert.equal(computeHeartbeatCredit(start, new Date("2026-08-18T09:59:59Z")), 0);
  assert.equal(computeHeartbeatCredit(new Date("invalid"), new Date()), 0);
});

test("activity rules distinguish playing video and interactive content", () => {
  const base = { isVisible: true, lastActivityAt: 1_000, now: 70_000, recentActivityMs: 60_000 };
  assert.equal(shouldSendLearningHeartbeat({ ...base, mode: "VIDEO", isPlaying: true }), true);
  assert.equal(shouldSendLearningHeartbeat({ ...base, mode: "VIDEO", isPlaying: false }), false);
  assert.equal(shouldSendLearningHeartbeat({ ...base, mode: "VIDEO", isPlaying: true, isVisible: false }), false);
  assert.equal(shouldSendLearningHeartbeat({ ...base, mode: "INTERACTIVE_CONTENT", now: 60_000 }), true);
  assert.equal(shouldSendLearningHeartbeat({ ...base, mode: "INTERACTIVE_CONTENT" }), false);
  assert.equal(shouldSendLearningHeartbeat({ ...base, mode: "INTERACTIVE_CONTENT", now: 60_000, isVisible: false }), false);
});

test("pedagogical status follows completion, inactivity and quiz failures", () => {
  const now = new Date("2026-08-18T10:00:00Z");
  assert.equal(derivePedagogicalStatus({ progressPercent: 0, lastAccessedAt: null, failedQuizCount: 0, now }), "NOT_STARTED");
  assert.equal(derivePedagogicalStatus({ progressPercent: 100, lastAccessedAt: null, failedQuizCount: 2, now }), "COMPLETED");
  assert.equal(derivePedagogicalStatus({ progressPercent: 20, lastAccessedAt: new Date("2026-07-01"), failedQuizCount: 0, now }), "INACTIVE");
  assert.equal(derivePedagogicalStatus({ progressPercent: 20, lastAccessedAt: now, failedQuizCount: 1, now }), "AT_RISK");
  assert.equal(derivePedagogicalStatus({ progressPercent: 20, lastAccessedAt: now, failedQuizCount: 0, now }), "IN_PROGRESS");
});
