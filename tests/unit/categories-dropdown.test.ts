import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "src/components/layout/categories-dropdown.tsx",
  "utf8",
);

test("le menu des catégories reste une ligne de liens textuels défilable", () => {
  assert.match(source, /flex min-w-0 flex-1 flex-nowrap/);
  assert.match(source, /overflow-x-auto scroll-smooth whitespace-nowrap/);
  assert.match(source, /shrink-0 items-center gap-3 after:h-4 after:w-px/);
  assert.match(source, /\{c\.name\}/);
  assert.doesNotMatch(source, /CategoryCard/);
});

test("les commandes de défilement et le lien global sont conservés", () => {
  assert.match(source, /scrollBy\(\{/);
  assert.match(source, /behavior: "smooth"/);
  assert.match(source, /Faire défiler les catégories vers la gauche/);
  assert.match(source, /Faire défiler les catégories vers la droite/);
  assert.match(source, /Voir toutes les catégories →/);
  assert.match(source, /href="\/categories"/);
});

test("le panneau reste contenu dans la largeur des écrans mobiles", () => {
  assert.match(source, /w-\[calc\(100vw-1\.5rem\)\] max-w-6xl/);
  assert.match(source, /flex-wrap items-center/);
  assert.match(source, /basis-full items-center gap-2 sm:basis-auto/);
  assert.match(source, /min-w-0/);
  assert.match(source, /whitespace-nowrap/);
});
