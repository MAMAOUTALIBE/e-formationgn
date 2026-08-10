import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  isStaffRole,
  LEARNER_ROLE,
  STAFF_ROLES,
} from "../../src/lib/account-audience";

const root = process.cwd();

test("les rôles internes et le rôle apprenant sont disjoints", () => {
  assert.equal(LEARNER_ROLE, "STUDENT");
  assert.deepEqual(STAFF_ROLES, [
    "INSTRUCTOR",
    "MANAGER",
    "MODERATOR",
    "SUPPORT",
    "FINANCE",
    "ADMIN",
  ]);
  assert.equal(isStaffRole("STUDENT"), false);
  assert.equal(isStaffRole("INSTRUCTOR"), true);
  assert.equal(isStaffRole("ADMIN"), true);
});

test("les lectures et actions apprenants imposent STUDENT côté serveur", async () => {
  const [queries, usersActions, enrollments, accounts, importStudents, csvParser] =
    await Promise.all([
      readFile(path.join(root, "src/server/queries/admin-users.ts"), "utf8"),
      readFile(path.join(root, "src/server/actions/admin-users.ts"), "utf8"),
      readFile(path.join(root, "src/server/actions/admin-enrollments.ts"), "utf8"),
      readFile(path.join(root, "src/server/actions/admin-accounts.ts"), "utf8"),
      readFile(path.join(root, "src/server/actions/admin-import-students.ts"), "utf8"),
      readFile(path.join(root, "src/lib/admin/csv-students.ts"), "utf8"),
    ]);

  assert.match(queries, /const where: Prisma\.UserWhereInput = \{ role: "STUDENT" \}/);
  assert.match(queries, /where: \{ role: "STUDENT", country:/);
  assert.doesNotMatch(queries, /role: \{ in: \["STUDENT", "INSTRUCTOR"\] \}/);
  assert.match(usersActions, /learnerIdsOrError/);
  assert.match(usersActions, /role: "STUDENT"/);
  assert.match(enrollments, /where: \{ id: \{ in: userIds \}, role: "STUDENT" \}/);
  assert.doesNotMatch(enrollments, /role: \{ in: \["STUDENT", "INSTRUCTOR"\] \}/);
  assert.match(accounts, /const CREATABLE_ROLES = \["STUDENT"\]/);
  assert.match(importStudents, /role: "STUDENT"/);
  assert.match(csvParser, /Un compte interne ne peut pas être importé comme apprenant/);
});

test("l’équipe interne dispose d’un écran et d’actions sans conversion en élève", async () => {
  const [staffPage, securityActions, detailPage, navigation, legacyActions] =
    await Promise.all([
      readFile(path.join(root, "src/app/admin/equipe/page.tsx"), "utf8"),
      readFile(path.join(root, "src/server/actions/admin-security.ts"), "utf8"),
      readFile(path.join(root, "src/app/admin/utilisateurs/[id]/page.tsx"), "utf8"),
      readFile(path.join(root, "src/lib/workspace/admin-nav.ts"), "utf8"),
      readFile(path.join(root, "src/server/actions/admin.ts"), "utf8"),
    ]);

  assert.match(staffPage, /data-testid="staff-workspace"/);
  assert.match(staffPage, /session\?\.user\?\.role !== "ADMIN"/);
  assert.match(staffPage, /role: \{ in: \[\.\.\.STAFF_ROLES\] \}/);
  assert.match(staffPage, /CreateStaffAccountForm/);
  assert.match(staffPage, /StaffAccessButton/);
  assert.match(securityActions, /if \(!isStaffRole\(user\.role\)\)/);
  assert.match(securityActions, /export async function createStaffAccount/);
  assert.match(securityActions, /export async function setStaffAccountStatus/);
  assert.doesNotMatch(securityActions, /data: \{ role: "STUDENT"/);
  assert.match(detailPage, /const backHref = isLearner \? "\/admin\/utilisateurs" : "\/admin\/equipe"/);
  assert.doesNotMatch(detailPage, /<option value="STUDENT">/);
  assert.match(navigation, /href: "\/admin\/equipe"/);
  assert.match(navigation, /label: "Équipe & accès"/);
  assert.doesNotMatch(legacyActions, /case "demote_admin":[\s\S]*?data: \{ role: "STUDENT" \}/);
});
