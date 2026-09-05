import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync("src/server/actions/admin-security.ts", "utf8");
const page = readFileSync("src/app/admin/formateurs/page.tsx", "utf8");
const list = readFileSync(
  "src/components/features/admin/instructors-list.tsx",
  "utf8",
);

test("l’archivage des formateurs est réservé à l’administrateur strict", () => {
  const action = actions.slice(
    actions.indexOf("export async function archiveInstructorAccounts"),
    actions.indexOf("export async function exportAuditLogCsv"),
  );

  assert.match(action, /await requireAdmin\(\)/);
  assert.match(action, /ids\.includes\(admin\.userId\)/);
  assert.match(action, /role: "INSTRUCTOR"/);
  assert.match(action, /isInstructor: true/);
  assert.match(action, /instructors\.length !== ids\.length/);
});

test("les entrées groupées sont validées et plafonnées", () => {
  assert.match(actions, /!Array\.isArray\(requestedIds\)/);
  assert.match(actions, /id\.length > 64/);
  assert.match(actions, /new Set\(requestedIds\)/);
  assert.match(actions, /ids\.length > 100/);
});

test("la suppression coupe les accès tout en conservant les données métier", () => {
  const action = actions.slice(
    actions.indexOf("export async function archiveInstructorAccounts"),
    actions.indexOf("export async function exportAuditLogCsv"),
  );

  assert.match(action, /prisma\.session\.deleteMany/);
  assert.match(action, /status: "DELETED"/);
  assert.match(action, /passwordChangedAt: archivedAt/);
  assert.doesNotMatch(action, /prisma\.user\.delete/);
  assert.doesNotMatch(action, /prisma\.course\.(delete|update)/);
  assert.match(action, /action: "instructor\.archive"/);
});

test("la liste active masque les archives mais le filtre permet de les retrouver", () => {
  assert.match(page, /status \? \{ status \} : \{ status: \{ not: "DELETED" \} \}/);
  assert.match(page, /<option value="DELETED">Archivés<\/option>/);
});

test("l’écran permet une suppression individuelle ou groupée avec confirmation", () => {
  assert.match(list, /archiveInstructorAccounts/);
  assert.match(list, /Sélectionner tous les formateurs affichés/);
  assert.match(list, /Supprimer les formateurs/);
  assert.match(list, /les comptes seront retirés de la liste active/);
  assert.match(list, /formation.*restera/);
});
