import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("l'application reste en mode clair sans sélecteur de thème", async () => {
  const [
    layout,
    globalStyles,
    siteHeader,
    mobileMenu,
    workspaceShell,
    workspaceDrawer,
  ] =
    await Promise.all([
      readFile(path.join(root, "src/app/layout.tsx"), "utf8"),
      readFile(path.join(root, "src/app/globals.css"), "utf8"),
      readFile(path.join(root, "src/components/layout/site-header.tsx"), "utf8"),
      readFile(path.join(root, "src/components/layout/mobile-menu.tsx"), "utf8"),
      readFile(
        path.join(root, "src/components/features/workspace/workspace-shell.tsx"),
        "utf8",
      ),
      readFile(
        path.join(
          root,
          "src/components/features/workspace/workspace-mobile-sidebar.tsx",
        ),
        "utf8",
      ),
    ]);

  assert.match(layout, /themeColor: "#ffffff"/);
  assert.doesNotMatch(layout, /prefers-color-scheme|ThemeProvider/);
  assert.match(globalStyles, /@custom-variant dark \(&:where\(\.dark, \.dark \*\)\);/);

  for (const source of [siteHeader, mobileMenu, workspaceShell, workspaceDrawer]) {
    assert.doesNotMatch(source, /ThemeToggle|Thème de l'interface|Apparence/);
  }
});
