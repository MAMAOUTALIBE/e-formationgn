import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("le header conserve ses fonctions tout en portant le nouveau traitement visuel", async () => {
  const [header, search, categories, navLink] = await Promise.all([
    readFile(path.join(root, "src/components/layout/site-header.tsx"), "utf8"),
    readFile(
      path.join(root, "src/components/features/courses/header-search.tsx"),
      "utf8",
    ),
    readFile(path.join(root, "src/components/layout/categories-dropdown.tsx"), "utf8"),
    readFile(path.join(root, "src/components/layout/nav-link.tsx"), "utf8"),
  ]);

  for (const component of ["Logo", "NotificationBell", "UserMenu", "MobileMenu"]) {
    assert.match(header, new RegExp(`<${component}`));
  }
  assert.match(header, /h-16/);
  assert.match(search, /rounded-full/);
  assert.match(search, /aria-label="Lancer la recherche"/);
  assert.match(categories, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(navLink, /aria-current=\{isActive \? "page" : undefined\}/);
});
