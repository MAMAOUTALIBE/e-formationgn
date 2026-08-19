import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("les transitions de statut sont sécurisées, auditées et invalident les vues utiles", async () => {
  const [actions, legacyActions, validator] = await Promise.all([
    readFile(path.join(root, "src/server/actions/admin-courses.ts"), "utf8"),
    readFile(path.join(root, "src/server/actions/admin.ts"), "utf8"),
    readFile(path.join(root, "src/lib/validators/admin.ts"), "utf8"),
  ]);

  for (const status of ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "REJECTED"]) {
    assert.match(actions, new RegExp(`"${status}"`));
  }
  assert.match(actions, /requireAdmin\(\)/);
  assert.match(actions, /failedCriteriaLabels\(course\)/);
  assert.match(actions, /reason\.length < 10/);
  assert.match(actions, /prisma\.\$transaction/);
  assert.match(actions, /COURSE_PUBLISHED/);
  assert.match(actions, /COURSE_REJECTED/);
  assert.match(actions, /oldStatus/);
  assert.match(actions, /newStatus: nextStatus/);
  assert.match(actions, /revalidatePath\(`\/admin\/cours\/\$\{course\.id\}`\)/);
  assert.match(actions, /revalidatePath\(`\/cours\/\$\{course\.slug\}`\)/);
  assert.match(actions, /invalidateCatalogCaches\(\)/);

  assert.match(legacyActions, /approveCourse\(parsed\.data\.courseId\)/);
  assert.match(legacyActions, /rejectCourse\(parsed\.data\.courseId/);
  assert.match(validator, /data\.reason\.length >= 10/);
});

test("le formulaire propose les décisions rapides puis l’édition complète et accessible", async () => {
  const [form, page] = await Promise.all([
    readFile(path.join(root, "src/components/features/admin/moderation-form.tsx"), "utf8"),
    readFile(path.join(root, "src/app/admin/cours/[id]/page.tsx"), "utf8"),
  ]);

  assert.match(page, /currentStatus=\{course\.status\}/);
  assert.match(form, /currentStatus === "PENDING_REVIEW"/);
  assert.match(form, />\s*Approuver\s*</);
  assert.match(form, />\s*Refuser\s*</);
  assert.match(form, /Modifier le statut/);
  assert.match(form, /EDITABLE_STATUSES/);
  assert.match(form, /minLength=\{10\}/);
  assert.match(form, /LoaderCircle/);
  assert.match(form, /aria-busy=\{pending\}/);
  assert.match(form, /CheckCircle2/);
  assert.match(form, /animate-in/);
  assert.match(form, /setConfirmation\(state\.message/);
  assert.match(form, /3_600/);
  assert.match(form, /\[router, state\]/);
  assert.match(form, /router\.refresh\(\)/);
  assert.doesNotMatch(page, /key=\{currentStatus\}/);
  assert.match(form, />\s*Annuler\s*</);
});
