import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sidebar = readFileSync(
  "src/components/features/workspace/workspace-sidebar.tsx",
  "utf8",
);
const shell = readFileSync(
  "src/components/features/workspace/workspace-shell.tsx",
  "utf8",
);

test("le logo du CRM réutilise la version transparente du footer", () => {
  assert.match(sidebar, /<Logo[\s\S]*?transparentBackground[\s\S]*?\/>/);
  assert.doesNotMatch(sidebar, /className="[^"]*bg-white[^"]*"/);
  assert.match(shell, /<Logo width=\{120\} priority transparentBackground \/>/);
});
