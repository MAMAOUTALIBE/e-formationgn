import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("le menu d’actions des formations reste opaque, contrasté et lisible", async () => {
  const source = await readFile(
    path.join(root, "src/components/features/admin/courses-table.tsx"),
    "utf8",
  );

  assert.match(source, /data-testid="course-actions-menu"/);
  assert.match(source, /AdminActionMenu/);
  assert.match(source, /Actions de la formation/);
  assert.match(source, /role="menuitem"/);
  assert.doesNotMatch(source, /from-brand-primary to-blue-950/);
});

test("la primitive partagée gère opacité, portail, clavier et menu unique", async () => {
  const source = await readFile(
    path.join(root, "src/components/ui/admin-action-menu.tsx"),
    "utf8",
  );
  for (const token of ["bg-popover", "text-popover-foreground", "border-border", "shadow-2xl", "z-[100]"]) {
    assert.match(source, new RegExp(token.replace(/[\[\]]/g, "\\$&")));
  }
  assert.match(source, /createPortal/);
  assert.match(source, /document\.body/);
  assert.match(source, /aria-haspopup="menu"/);
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /event\.key === "Tab"/);
  assert.match(source, /"ArrowDown", "ArrowUp", "Home", "End"/);
  assert.match(source, /pointerdown/);
  assert.match(source, /OPEN_EVENT/);
  assert.match(source, /inset-x-3 bottom-3/);
  assert.match(source, /sm:inset-x-auto sm:bottom-auto/);
});

test("les menus apprenants et formations ferment avant action ou navigation", async () => {
  const learners = await readFile(path.join(root, "src/components/features/admin/learners-table.tsx"), "utf8");
  const courses = await readFile(path.join(root, "src/components/features/admin/courses-table.tsx"), "utf8");
  assert.match(learners, /AdminActionMenu/);
  assert.match(learners, /onSelect=\{close\}/);
  assert.match(learners, /close\(\); assign/);
  assert.match(courses, /onSelect=\{close\}/);
  assert.match(courses, /close\(\); onAction/);
});
