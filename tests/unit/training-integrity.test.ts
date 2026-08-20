import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ACTIVE_PROGRAM_REQUIRES_COURSE,
  CERTIFICATE_REQUIRES_COMPLETION,
  canActivateProgram,
  canIssueCertificate,
} from "../../src/lib/domain/training-integrity";

test("un programme ne peut être actif sans cours", () => {
  assert.equal(canActivateProgram(0), false);
  assert.equal(canActivateProgram(1), true);
  assert.match(ACTIVE_PROGRAM_REQUIRES_COURSE, /au moins un cours/i);
});

test("une attestation exige exactement 100 % et une date d'achèvement", () => {
  const completedAt = new Date("2026-08-20T12:00:00Z");
  assert.equal(canIssueCertificate({ progressPercent: 99, completedAt }), false);
  assert.equal(canIssueCertificate({ progressPercent: 100, completedAt: null }), false);
  assert.equal(canIssueCertificate({ progressPercent: 100, completedAt }), true);
  assert.equal(canIssueCertificate({ progressPercent: 101, completedAt }), false);
  assert.match(CERTIFICATE_REQUIRES_COMPLETION, /Terminez/i);
});

test("les mutations et la base appliquent les garde-fous", () => {
  const programs = readFileSync("src/server/actions/admin-programs.ts", "utf8");
  const certificates = readFileSync("src/server/actions/certificates.ts", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  assert.match(programs, /data: \{ \.\.\.parsed\.data, status: "DRAFT" \}/);
  assert.match(programs, /TransactionIsolationLevel\.Serializable/);
  assert.match(programs, /Passez-le en brouillon avant de retirer son dernier cours/);
  assert.match(certificates, /canIssueCertificate\(enrollment\)/);
  assert.match(certificates, /error\.code === "P2002"/);
  assert.match(schema, /@@unique\(\[userId, courseId\]\)/);
});

test("le script de réparation reste dry-run et exige deux confirmations", () => {
  const repair = readFileSync("scripts/repair-training-integrity.ts", "utf8");
  assert.match(repair, /process\.argv\.includes\("--apply"\)/);
  assert.match(repair, /--confirm=REPAIR_TRAINING_INTEGRITY/);
  assert.match(repair, /--confirm-production=I_HAVE_A_VERIFIED_BACKUP/);
  assert.match(repair, /source: "ADMIN_GRANT"/);
  assert.match(repair, /progressPercent: 100/);
  assert.match(repair, /isCompleted: true/);
});
