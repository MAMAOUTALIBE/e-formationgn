import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { COURSE_NOT_DELETABLE_MESSAGE, executeCourseDeletion, type CourseDeletionDependencies } from "../../src/lib/domain/course-deletion";

function harness(overrides: Partial<CourseDeletionDependencies> = {}) {
  const events: string[] = [];
  const deps: CourseDeletionDependencies = {
    authorize: async () => { events.push("authorize"); return { userId: "actor-1" }; },
    deleteRecord: async () => { events.push("delete"); return { kind: "deleted", title: "Test", media: { ownerId: "owner-1", muxAssetIds: ["mux-1"], storedUrls: ["/uploads/test.mp4"] } }; },
    cleanup: async () => { events.push("cleanup"); },
    audit: async () => { events.push("audit"); },
    onDeleted: () => { events.push("revalidate"); },
    ...overrides,
  };
  return { deps, events };
}

test("suppression autorisée : DB avant médias, puis audit et revalidation", async () => {
  const { deps, events } = harness();
  assert.deepEqual(await executeCourseDeletion(deps), { success: true, message: "Formation supprimée définitivement." });
  assert.deepEqual(events, ["authorize", "delete", "cleanup", "audit", "revalidate"]);
});

test("un refus d'autorisation arrête tous les effets", async () => {
  const { deps, events } = harness({ authorize: async () => { events.push("authorize"); throw new Error("forbidden"); } });
  assert.deepEqual(await executeCourseDeletion(deps), { success: false, message: "Accès refusé." });
  assert.deepEqual(events, ["authorize"]);
});

for (const [kind, expected] of [
  ["blocked", COURSE_NOT_DELETABLE_MESSAGE],
  ["missing", "Formation introuvable."],
  ["concurrent", "Modification concurrente détectée. Réessayez."],
] as const) {
  test(`${kind} ne nettoie, n'audite ni ne revalide`, async () => {
    const { deps, events } = harness({ deleteRecord: async () => { events.push("delete"); return { kind }; } });
    assert.deepEqual(await executeCourseDeletion(deps), { success: false, message: expected });
    assert.deepEqual(events, ["authorize", "delete"]);
  });
}

test("la transaction bloque toutes les relations sensibles et collecte seulement les médias du cours", () => {
  const service = readFileSync("src/server/services/course-deletion.ts", "utf8");
  assert.match(service, /orderItems: true, enrollments: true, certificates: true, programs: true/);
  assert.match(service, /counts\.orderItems \|\| counts\.enrollments \|\| counts\.certificates \|\| counts\.programs/);
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(service, /error\.code === "P2003"/);
  assert.match(service, /error\.code === "P2034"/);
  assert.match(service, /promoVideoMuxId/);
  assert.match(service, /heroBackgroundUrl/);
  assert.match(service, /lesson\.resources\.map/);
});

test("l’administration permet de retirer plusieurs formations sans détruire leur historique", () => {
  const actions = readFileSync("src/server/actions/admin-courses.ts", "utf8");
  const table = readFileSync("src/components/features/admin/courses-table.tsx", "utf8");

  assert.match(actions, /export async function bulkRemoveCourses/);
  assert.match(actions, /requireAnyAdminRole\("ADMIN"\)/);
  assert.match(actions, /deleteCourseRecordIfUnused\(courseId\)/);
  assert.match(actions, /outcome\.kind === "blocked" \|\| outcome\.kind === "concurrent"/);
  assert.match(actions, /data: \{ status: "ARCHIVED" \}/);
  assert.match(actions, /Array\.isArray\(courseIds\)/);
  assert.match(actions, /uniqueCourseIds\.length > 100/);

  assert.match(table, /bulkRemoveCourses\(selectedIds\)/);
  assert.match(table, /> Supprimer/);
  assert.match(table, /Supprimer ou archiver/);
  assert.match(table, /afin de préserver leurs données/);
});
