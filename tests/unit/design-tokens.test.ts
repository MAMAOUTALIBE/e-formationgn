import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Tailwind v4 n'a pas de palette implicite : une classe `bg-x` n'existe QUE si
// `--color-x` est déclaré dans `@theme`. Une classe orpheline ne produit alors
// aucune règle — silencieusement. C'est ainsi que les menus d'actions sont
// restés transparents : `bg-popover` était écrit partout, `--popover` nulle
// part. Ce test transforme cette panne muette en échec de test.

const css = readFileSync("src/app/globals.css", "utf8");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".tsx") || path.endsWith(".ts") ? [path] : [];
  });
}

function themeTokens(): Set<string> {
  const block = css.match(/@theme inline \{([\s\S]*?)\n\}/)?.[1] ?? "";
  return new Set([...block.matchAll(/--color-([a-z0-9-]+):/g)].map((match) => match[1]));
}

test("chaque couleur utilisée dans le JSX est déclarée dans @theme", () => {
  const declared = themeTokens();
  const orphans = new Map<string, string>();
  for (const file of sourceFiles("src")) {
    const source = readFileSync(file, "utf8");
    for (const [, token] of source.matchAll(/\b(?:bg|text|border|ring|fill|stroke|divide)-((?:popover|card|muted|accent|secondary|primary|destructive|input|ring|foreground|background|border)(?:-foreground)?)\b/g)) {
      if (!declared.has(token) && !orphans.has(token)) orphans.set(token, file);
    }
  }
  assert.deepEqual([...orphans], [], `couleurs sans jeton --color-* : ${[...orphans.keys()].join(", ")}`);
});

test("les surfaces flottantes sont opaques et contrastées dans les deux thèmes", () => {
  // Un menu translucide laisse le tableau situé dessous transparaître entre
  // les lignes de texte : opacité pleine exigée, en clair comme en sombre.
  for (const scope of [/^:root \{([\s\S]*?)\n\}/m, /^\.dark \{([\s\S]*?)\n\}/m]) {
    const block = css.match(scope)?.[1] ?? "";
    const popover = block.match(/--popover:\s*([^;]+);/)?.[1]?.trim();
    assert.ok(popover, "--popover doit être défini");
    assert.match(popover, /^#[0-9a-f]{6}$/i, `--popover doit être une couleur opaque, reçu « ${popover} »`);
    assert.ok(block.includes("--popover-foreground:"), "--popover-foreground doit être défini");
  }
});

test("aucun jeton n'est enveloppé dans hsl() — ce sont des couleurs complètes", () => {
  // `hsl(var(--border))` produit `hsl(#e2e8f0)`, une valeur invalide que le
  // navigateur ignore : bordure et fond disparaissent sans le moindre message.
  for (const file of sourceFiles("src")) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /hsl\(var\(--/, `${file} enveloppe un jeton dans hsl()`);
  }
});

test("le menu d'actions est opaque, superposé et fermé au clavier", () => {
  const menu = readFileSync("src/components/ui/admin-action-menu.tsx", "utf8");
  assert.match(menu, /bg-popover/);
  assert.match(menu, /text-popover-foreground/);
  assert.match(menu, /z-\[100\]/);
  assert.match(menu, /shadow-2xl/);
  assert.match(menu, /border-border/);
  assert.match(menu, /createPortal/); // hors du tableau : aucun overflow ne le rogne
  assert.match(menu, /event\.key === "Escape"/);
  assert.match(menu, /sm:hidden/); // voile réservé au format feuille mobile
});

test("les entrées de menu montrent le focus même reçu par programme", () => {
  // À l'ouverture, le premier élément est focalisé par `.focus()` après un clic
  // souris : `:focus-visible` ne s'applique pas, `focus:` reste nécessaire.
  for (const file of [
    "src/components/features/admin/learners-table.tsx",
    "src/components/features/admin/courses-table.tsx",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /focus:bg-muted/, file);
    assert.match(source, /focus-visible:ring-2/, file);
  }
});
