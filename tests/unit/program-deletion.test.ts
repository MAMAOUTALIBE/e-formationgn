import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { executeProgramDeletion, PROGRAM_NOT_DELETABLE_MESSAGE, type ProgramDeletionDependencies } from "../../src/lib/domain/program-deletion";

function harness(overrides: Partial<ProgramDeletionDependencies> = {}) {
  const audits: Parameters<ProgramDeletionDependencies["audit"]>[0][] = [];
  const paths: string[] = [];
  const dependencies: ProgramDeletionDependencies = {
    authorize: async () => ({ userId: "admin-1" }),
    deleteIfUnused: async () => ({ id: "program-1", title: "Essai", code: "TEST" }),
    audit: async (input) => { audits.push(input); },
    revalidate: (path) => { paths.push(path); },
    ...overrides,
  };
  return { dependencies, audits, paths };
}

test("supprime un programme inutilisé, audite et revalide les deux vues", async () => {
  const { dependencies, audits, paths } = harness();
  const result = await executeProgramDeletion(dependencies, "program-1");
  assert.equal(result.success, true);
  assert.match(result.message ?? "", /Essai.*supprimé définitivement/);
  assert.deepEqual(audits, [{ actorId: "admin-1", action: "program.delete", targetType: "Program", targetId: "program-1", metadata: { title: "Essai", code: "TEST" } }]);
  assert.deepEqual(paths, ["/admin/formations", "/admin/formations/program-1"]);
});

test("refuse l'accès avant de tenter la suppression", async () => {
  let deletionCalled = false;
  const { dependencies, audits, paths } = harness({
    authorize: async () => { throw new Error("forbidden"); },
    deleteIfUnused: async () => { deletionCalled = true; return null; },
  });
  assert.deepEqual(await executeProgramDeletion(dependencies, "program-1"), { success: false, message: "Accès refusé." });
  assert.equal(deletionCalled, false);
  assert.deepEqual(audits, []);
  assert.deepEqual(paths, []);
});

test("retourne introuvable sans audit ni revalidation", async () => {
  const { dependencies, audits, paths } = harness({ deleteIfUnused: async () => null });
  const result = await executeProgramDeletion(dependencies, "missing");
  assert.equal(result.success, false);
  assert.match(result.message ?? "", /introuvable/i);
  assert.deepEqual(audits, []);
  assert.deepEqual(paths, []);
});

test("bloque un programme ayant une session et propose l'archivage", async () => {
  const { dependencies, audits, paths } = harness({ deleteIfUnused: async () => "blocked" });
  assert.deepEqual(await executeProgramDeletion(dependencies, "program-1"), { success: false, programId: "program-1", message: PROGRAM_NOT_DELETABLE_MESSAGE });
  assert.deepEqual(audits, []);
  assert.deepEqual(paths, []);
});

for (const code of ["P2003", "P2034"] as const) {
  test(`traite l'erreur concurrente ${code} sans effet secondaire`, async () => {
    const { dependencies, audits, paths } = harness({ deleteIfUnused: async () => { throw { code }; } });
    const result = await executeProgramDeletion(dependencies, "program-1");
    assert.equal(result.success, false);
    assert.match(result.message ?? "", code === "P2003" ? /Archivez-le/ : /concurrente.*Réessayez/);
    assert.deepEqual(audits, []);
    assert.deepEqual(paths, []);
  });
}

test("la couche Prisma garde le contrôle et la suppression en transaction sérialisable", () => {
  const actions = readFileSync("src/server/actions/admin-programs.ts", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(actions, /program\._count\.sessions > 0/);
  assert.match(actions, /tx\.program\.delete/);
  assert.match(actions, /TransactionIsolationLevel\.Serializable/);
  assert.match(schema, /program\s+Program @relation\(fields: \[programId\], references: \[id\], onDelete: Cascade\)/);
});

test("l'état bloqué de la liste est une action tactile et accessible vers l'archivage", () => {
  const button = readFileSync("src/components/features/admin/program-delete-button.tsx", "utf8");
  const list = readFileSync("src/app/admin/formations/page.tsx", "utf8");
  assert.match(button, /href=\{`\/admin\/formations\/\$\{programId\}#program-information`\}/);
  assert.match(button, /aria-label=\{`Archiver le programme/);
  assert.match(button, />\s*Archiver\s*</);
  assert.equal((list.match(/presentation="compact"/g) ?? []).length, 2);
});
