import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  resolveThemeScope,
  THEME_SCOPES,
  themeStorageKey,
} from "../../src/lib/theme-scope";

const root = process.cwd();

test("chaque grande surface utilise une préférence de thème indépendante", () => {
  assert.equal(resolveThemeScope("/"), "public");
  assert.equal(resolveThemeScope("/cours/nextjs"), "public");
  assert.equal(resolveThemeScope("/connexion"), "public");
  assert.equal(resolveThemeScope("/admin"), "admin");
  assert.equal(resolveThemeScope("/admin/cours/abc"), "admin");
  assert.equal(resolveThemeScope("/formateur"), "formateur");
  assert.equal(resolveThemeScope("/formateur/cours/abc"), "formateur");
  assert.equal(resolveThemeScope("/apprentissage"), "eleve");
  assert.equal(resolveThemeScope("/apprentissage/nextjs/lecons/abc"), "eleve");
  assert.equal(resolveThemeScope("/wishlist"), "eleve");
  assert.equal(resolveThemeScope("/notifications"), "eleve");
  assert.equal(resolveThemeScope("/profil"), "eleve");
  assert.equal(resolveThemeScope("/administrator"), "public");

  const keys = THEME_SCOPES.map(themeStorageKey);
  assert.equal(new Set(keys).size, THEME_SCOPES.length);
  assert.deepEqual(keys, [
    "gandal-theme-public",
    "gandal-theme-admin",
    "gandal-theme-formateur",
    "gandal-theme-eleve",
  ]);
});

test("le thème clair est le défaut et les sélecteurs restent accessibles", async () => {
  const [provider, siteHeader, mobileMenu, workspaceDrawer] = await Promise.all([
    readFile(path.join(root, "src/components/features/theme/theme-provider.tsx"), "utf8"),
    readFile(path.join(root, "src/components/layout/site-header.tsx"), "utf8"),
    readFile(path.join(root, "src/components/layout/mobile-menu.tsx"), "utf8"),
    readFile(
      path.join(root, "src/components/features/workspace/workspace-mobile-sidebar.tsx"),
      "utf8",
    ),
  ]);

  assert.match(provider, /key=\{scope\}/);
  assert.match(provider, /storageKey=\{themeStorageKey\(scope\)\}/);
  assert.match(provider, /defaultTheme="light"/);
  assert.doesNotMatch(provider, /defaultTheme="system"/);
  assert.match(siteHeader, /<ThemeToggle className="hidden md:inline-flex" \/>/);
  assert.match(siteHeader, /className="hidden items-center gap-6 lg:flex"/);
  assert.match(siteHeader, /className="hidden flex-1 max-w-md lg:block"/);
  assert.match(mobileMenu, /Apparence/);
  assert.match(mobileMenu, /<ThemeToggle \/>/);
  assert.match(mobileMenu, /lg:hidden/);
  assert.match(workspaceDrawer, /md:hidden/);
  assert.match(workspaceDrawer, /<ThemeToggle \/>/);
});
