import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("le header réserve la largeur des commandes sans recouvrir la recherche", async () => {
  const source = await readFile(
    path.join(root, "src/components/features/workspace/workspace-shell.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(16rem,36rem\)_minmax\(max-content,1fr\)\]/,
  );
  assert.match(source, /<ThemeToggle className="hidden md:inline-flex" \/>/);
  assert.match(source, /<UserMenu showIdentity user=\{user\} \/>/);
  assert.doesNotMatch(source, /lg:grid-cols-\[1fr_minmax\(16rem,36rem\)_1fr\]/);
});
