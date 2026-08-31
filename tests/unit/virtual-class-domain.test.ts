import assert from "node:assert/strict";
import test from "node:test";

import {
  attendanceStatusForDuration,
  isMessageVisibleToLearner,
  isReplayWithinRetention,
  summarizeUserAgent,
  VIRTUAL_CLASS_REPLAY_RETENTION_DAYS,
  virtualClassReplayExpiry,
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

test("la fenêtre d’ouverture anticipée laisse entrer sans attendre le formateur", () => {
  const startsAt = new Date("2026-09-01T10:00:00.000Z");
  const scheduledEndAt = new Date("2026-09-01T11:00:00.000Z");
  const base = { status: "SCHEDULED" as const, startsAt, scheduledEndAt, earlyJoinMinutes: 15 };

  // Avant la fenêtre : la salle reste fermée.
  assert.match(
    virtualClassJoinError({ ...base, now: new Date("2026-09-01T09:44:00.000Z") }) ?? "",
    /pas encore ouverte/,
  );
  // Dans la fenêtre : le réglage produit enfin un effet, alors qu'il était
  // stocké et affiché sans qu'aucun chemin d'exécution ne le lise.
  assert.equal(virtualClassJoinError({ ...base, now: new Date("2026-09-01T09:45:00.000Z") }), null);
  assert.equal(virtualClassJoinError({ ...base, now: new Date("2026-09-01T10:30:00.000Z") }), null);

  // `earlyJoinMinutes: 0` — aucune anticipation, mais l'heure pile passe.
  const strict = { ...base, earlyJoinMinutes: 0 };
  assert.match(
    virtualClassJoinError({ ...strict, now: new Date("2026-09-01T09:59:59.000Z") }) ?? "",
    /pas encore ouverte/,
  );
  assert.equal(virtualClassJoinError({ ...strict, now: startsAt }), null);
});

test("la fenêtre anticipée ne contourne ni l’annulation ni la fin de séance", () => {
  const startsAt = new Date("2026-09-01T10:00:00.000Z");
  const scheduledEndAt = new Date("2026-09-01T11:00:00.000Z");
  const inWindow = new Date("2026-09-01T09:50:00.000Z");

  // Une séance annulée reste fermée même en pleine fenêtre d'ouverture.
  assert.match(
    virtualClassJoinError({ status: "CANCELLED", startsAt, scheduledEndAt, earlyJoinMinutes: 60, now: inWindow }) ?? "",
    /annulée/,
  );
  assert.match(
    virtualClassJoinError({ status: "ENDED", startsAt, scheduledEndAt, earlyJoinMinutes: 60, now: inWindow }) ?? "",
    /terminée/,
  );
  // Passé l'heure de fin, une anticipation généreuse ne rouvre rien.
  assert.match(
    virtualClassJoinError({ status: "SCHEDULED", startsAt, scheduledEndAt, earlyJoinMinutes: 600, now: new Date("2026-09-01T11:00:01.000Z") }) ?? "",
    /terminée/,
  );
  // Un brouillon n'est jamais joignable, quelle que soit l'heure.
  assert.match(
    virtualClassJoinError({ status: "DRAFT", startsAt, scheduledEndAt, earlyJoinMinutes: 60, now: inWindow }) ?? "",
    /pas encore ouverte/,
  );
});

test("sans fenêtre transmise, seul un statut ouvert autorise l’entrée", () => {
  // Les appelants qui ne passent pas `startsAt`/`earlyJoinMinutes` doivent
  // conserver l'ancien comportement, strictement fondé sur le statut.
  const scheduledEndAt = new Date("2026-09-01T11:00:00.000Z");
  const now = new Date("2026-09-01T10:00:00.000Z");
  assert.match(virtualClassJoinError({ status: "SCHEDULED", scheduledEndAt, now }) ?? "", /pas encore ouverte/);
  assert.equal(virtualClassJoinError({ status: "OPEN", scheduledEndAt, now }), null);
  assert.equal(virtualClassJoinError({ status: "LIVE", scheduledEndAt, now }), null);
});

test("la conservation d’un replay court à partir de sa publication", () => {
  const publishedAt = new Date("2026-09-01T10:00:00.000Z");
  const expiry = virtualClassReplayExpiry(publishedAt);
  assert.equal(
    Math.round((expiry.getTime() - publishedAt.getTime()) / (24 * 60 * 60_000)),
    VIRTUAL_CLASS_REPLAY_RETENTION_DAYS,
  );
  // Une seconde avant l'échéance, le replay est encore lisible.
  assert.equal(isReplayWithinRetention(expiry, new Date(expiry.getTime() - 1_000)), true);
  assert.equal(isReplayWithinRetention(expiry, expiry), false);
  assert.equal(isReplayWithinRetention(expiry, new Date(expiry.getTime() + 1_000)), false);
});

test("un enregistrement sans échéance reste accessible", () => {
  // Les enregistrements antérieurs à la mise en place de la rétention n'ont
  // pas d'échéance : on ne les rend pas inaccessibles rétroactivement, la
  // purge ne cible que les lignes réellement datées.
  assert.equal(isReplayWithinRetention(null), true);
  assert.equal(isReplayWithinRetention(undefined), true);
});

test("les messages du direct ne restent lisibles après la séance que si c’est prévu", () => {
  const ephemere = { visibleAfterClass: false };
  const conserve = { visibleAfterClass: true };
  // Pendant la séance, tout est visible.
  for (const statut of ["OPEN", "LIVE", "SCHEDULED"] as const) {
    assert.equal(isMessageVisibleToLearner(ephemere, statut), true);
    assert.equal(isMessageVisibleToLearner(conserve, statut), true);
  }
  // Une fois terminée, seuls les messages marqués restent lisibles.
  assert.equal(isMessageVisibleToLearner(ephemere, "ENDED"), false);
  assert.equal(isMessageVisibleToLearner(conserve, "ENDED"), true);
});

test("l’environnement du participant est résumé sans ambiguïté", () => {
  // Chrome annonce « Safari », Edge annonce « Chrome » ET « Safari » : un test
  // naïf par sous-chaîne se trompe sur trois navigateurs sur cinq.
  const cas = [
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36", "Chrome", "Windows", false],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0", "Edge", "Windows", false],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", "Safari", "macOS", false],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1", "Safari", "iOS", true],
    ["Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36", "Chrome", "Android", true],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0", "Firefox", "Linux", false],
  ] as const;
  for (const [ua, browser, os, mobile] of cas) {
    const resume = summarizeUserAgent(ua);
    assert.equal(resume.browser, browser, `navigateur mal identifié : ${ua}`);
    assert.equal(resume.os, os, `système mal identifié : ${ua}`);
    assert.equal(resume.mobile, mobile, `nature mobile mal identifiée : ${ua}`);
  }
});

test("un User-Agent absent ou aberrant ne fait pas échouer le relevé", () => {
  for (const valeur of [null, undefined, "", "  ", "curl/8.4.0"]) {
    const resume = summarizeUserAgent(valeur);
    assert.equal(resume.browser, "Inconnu");
    assert.equal(resume.os, "Inconnu");
    assert.equal(resume.mobile, false);
  }
  // Chaîne démesurée : tronquée, jamais propagée telle quelle en base.
  assert.doesNotThrow(() => summarizeUserAgent("A".repeat(100_000)));
});
