import assert from "node:assert/strict";
import test from "node:test";

import {
  attendanceStatusForDuration,
  canTransitionVirtualClass,
  resolveVirtualClassRoomRole,
  totalAttendanceSeconds,
  virtualClassCanBeOpened,
  virtualClassJoinError,
  virtualClassPublishingPolicy,
} from "../../src/lib/domain/virtual-class";

test("la machine d’état refuse les transitions incohérentes", () => {
  assert.equal(canTransitionVirtualClass("DRAFT", "SCHEDULED"), true);
  assert.equal(canTransitionVirtualClass("SCHEDULED", "OPEN"), true);
  assert.equal(canTransitionVirtualClass("OPEN", "LIVE"), true);
  assert.equal(canTransitionVirtualClass("LIVE", "ENDED"), true);
  assert.equal(canTransitionVirtualClass("ENDED", "OPEN"), false);
  assert.equal(canTransitionVirtualClass("CANCELLED", "LIVE"), false);
});

test("les rôles de salle sont dérivés côté serveur sans promotion implicite", () => {
  assert.equal(resolveVirtualClassRoomRole({ userRole: "STUDENT", userId: "student", instructorId: "teacher", hasActiveRegistration: true }), "STUDENT");
  assert.equal(resolveVirtualClassRoomRole({ userRole: "STUDENT", userId: "student", instructorId: "teacher", hasActiveRegistration: false }), null);
  assert.equal(resolveVirtualClassRoomRole({ userRole: "INSTRUCTOR", userId: "other", instructorId: "teacher", hasActiveRegistration: false }), null);
  assert.equal(resolveVirtualClassRoomRole({ userRole: "INSTRUCTOR", userId: "teacher", instructorId: "teacher", hasActiveRegistration: false }), "INSTRUCTOR");
});

test("un apprenant ne reçoit jamais les permissions de publication du formateur", () => {
  const student = virtualClassPublishingPolicy("STUDENT");
  assert.equal(student.canSubscribe, true);
  assert.equal(student.canPublish, false);
  assert.deepEqual(student.sources, []);
  const instructor = virtualClassPublishingPolicy("INSTRUCTOR");
  assert.equal(instructor.canPublish, true);
  assert.ok((instructor.sources as readonly string[]).includes("SCREEN_SHARE"));
});

test("les reconnexions sont cumulées sans compter les intervalles négatifs", () => {
  const now = new Date("2026-09-01T11:00:00.000Z");
  assert.equal(totalAttendanceSeconds([
    { joinedAt: new Date("2026-09-01T10:00:00.000Z"), leftAt: new Date("2026-09-01T10:15:00.000Z") },
    { joinedAt: new Date("2026-09-01T10:30:00.000Z"), leftAt: null },
    { joinedAt: new Date("2026-09-01T12:00:00.000Z"), leftAt: now },
  ], now), 2_700);
});

test("l’ouverture anticipée respecte la fenêtre configurée", () => {
  const startsAt = new Date("2026-09-01T10:00:00.000Z");
  const scheduledEndAt = new Date("2026-09-01T11:00:00.000Z");
  assert.equal(virtualClassCanBeOpened({ status: "SCHEDULED", startsAt, scheduledEndAt, earlyJoinMinutes: 15, now: new Date("2026-09-01T09:44:59.000Z") }), false);
  assert.equal(virtualClassCanBeOpened({ status: "SCHEDULED", startsAt, scheduledEndAt, earlyJoinMinutes: 15, now: new Date("2026-09-01T09:45:00.000Z") }), true);
});

test("un modérateur peut ouvrir une salle plusieurs jours avant le début", () => {
  const startsAt = new Date("2026-09-10T10:00:00.000Z");
  const scheduledEndAt = new Date("2026-09-10T11:00:00.000Z");
  assert.equal(virtualClassCanBeOpened({
    status: "SCHEDULED",
    startsAt,
    scheduledEndAt,
    earlyJoinMinutes: 15,
    allowBeforeOpeningWindow: true,
    now: new Date("2026-09-01T08:00:00.000Z"),
  }), true);
});

test("la dérogation anticipée ne rouvre jamais une séance terminée ou annulée", () => {
  const input = {
    startsAt: new Date("2026-09-01T10:00:00.000Z"),
    scheduledEndAt: new Date("2026-09-01T11:00:00.000Z"),
    earlyJoinMinutes: 15,
    allowBeforeOpeningWindow: true,
    now: new Date("2026-09-01T12:00:00.000Z"),
  } as const;
  assert.equal(virtualClassCanBeOpened({ ...input, status: "SCHEDULED" }), false);
  assert.equal(virtualClassCanBeOpened({ ...input, status: "CANCELLED" }), false);
});

test("une classe programmée à l’instant présent est immédiatement ouvrable", () => {
  const now = new Date("2026-09-01T10:00:00.000Z");
  assert.equal(virtualClassCanBeOpened({
    status: "SCHEDULED",
    startsAt: now,
    scheduledEndAt: new Date(now.getTime() + 60 * 60_000),
    earlyJoinMinutes: 0,
    now,
  }), true);
});

test("seules les salles ouvertes ou en direct sont joignables", () => {
  const scheduledEndAt = new Date("2026-09-01T11:00:00.000Z");
  const now = new Date("2026-09-01T10:00:00.000Z");
  assert.match(virtualClassJoinError({ status: "SCHEDULED", scheduledEndAt, now }) ?? "", /pas encore ouverte/);
  assert.equal(virtualClassJoinError({ status: "OPEN", scheduledEndAt, now }), null);
  assert.match(virtualClassJoinError({ status: "CANCELLED", scheduledEndAt, now }) ?? "", /annulée/);
});

test("le statut de présence utilise un seuil de 80 %", () => {
  assert.equal(attendanceStatusForDuration(0, 3600), "ABSENT");
  assert.equal(attendanceStatusForDuration(1200, 3600), "PARTIAL");
  assert.equal(attendanceStatusForDuration(2880, 3600), "PRESENT");
});
