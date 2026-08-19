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
  assert.match(source, /from-brand-primary to-blue-950/);
  assert.match(source, /border-2 border-blue-300\/70/);
  assert.match(source, /shadow-\[0_20px_50px_rgba\(15,23,42,0\.45\)\]/);
  assert.match(source, /inset-x-4 bottom-4/);
  assert.match(source, /sm:inset-x-auto sm:bottom-auto sm:right-8/);
  assert.match(source, /Actions de la formation/);
  assert.match(source, /bg-red-500\/15 text-red-100/);
  assert.doesNotMatch(source, /bg-popover p-1 text-sm text-popover-foreground shadow-xl/);
});
