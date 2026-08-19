import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("le header réserve et espace les commandes sans recouvrir la recherche", async () => {
  const [source, userMenuSource] = await Promise.all([
    readFile(path.join(root, "src/components/features/workspace/workspace-shell.tsx"), "utf8"),
    readFile(path.join(root, "src/components/features/auth/user-menu.tsx"), "utf8"),
  ]);

  assert.match(
    source,
    /lg:grid-cols-\[minmax\(0,1fr\)_minmax\(16rem,36rem\)_minmax\(max-content,1fr\)\]/,
  );
  assert.match(source, /lg:gap-5 lg:px-6 xl:gap-6/);
  assert.match(source, /sm:gap-2 lg:gap-3/);
  assert.match(source, /<ThemeToggle className="hidden md:inline-flex" \/>/);
  assert.match(source, /<UserMenu showIdentity user=\{user\} \/>/);
  assert.doesNotMatch(source, /lg:grid-cols-\[1fr_minmax\(16rem,36rem\)_1fr\]/);
  assert.match(userMenuSource, /showIdentity && "xl:pr-2\.5"/);
  assert.match(userMenuSource, /text-left xl:block/);
  assert.doesNotMatch(userMenuSource, /showIdentity && "lg:pr-2\.5"/);
});

test("la coquille occupe toujours tout le viewport sans espace sous le footer", async () => {
  const [source, styles] = await Promise.all([
    readFile(
      path.join(root, "src/components/features/workspace/workspace-shell.tsx"),
      "utf8",
    ),
    readFile(path.join(root, "src/app/globals.css"), "utf8"),
  ]);

  assert.match(source, /h-\[100dvh\] min-h-\[100dvh\]/);
  assert.match(source, /min-w-0 shrink-0 overflow-hidden/);
  assert.match(source, /workspace-main min-h-0 min-w-0 flex-1 overflow-y-auto/);
  assert.match(styles, /html:has\(\.workspace-shell\),\s*body:has\(\.workspace-shell\)/);
  assert.match(styles, /height: 100%;\s*overflow: hidden;/);
  assert.match(styles, /\.workspace-main \{\s*contain: paint;/);
});
