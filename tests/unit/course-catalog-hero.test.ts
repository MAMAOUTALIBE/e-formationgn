import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = readFileSync("src/app/cours/page.tsx", "utf8");
const search = readFileSync(
  "src/components/features/courses/course-search-bar.tsx",
  "utf8",
);

test("le hero du catalogue utilise le fond IA dédié sans modifier ses textes", () => {
  assert.match(catalog, /catalog-hero-ai-renovation\.webp/);
  assert.doesNotMatch(catalog, /min-h-\[clamp\(22rem,34vw,41rem\)\]/);
  assert.match(catalog, /relative isolate overflow-hidden/);
  assert.match(catalog, /Catalogue des formations/);
  assert.match(catalog, /label: "Accueil"/);
  assert.match(catalog, /label: "Catalogue"/);
  assert.match(catalog, /<CourseSearchBar integrated \/>/);
});

test("la recherche intégrée forme une capsule compacte avec son bouton", () => {
  assert.match(search, /integrated\?: boolean/);
  assert.match(search, /max-w-3xl gap-0 rounded-full/);
  assert.match(search, /border-0 bg-transparent/);
  assert.match(search, /shrink-0 rounded-full/);
  assert.match(search, /\{pending \? "Recherche…" : "Rechercher"\}/);
});

test("la présentation standard reste disponible pour les autres pages", () => {
  assert.match(search, /integrated = false/);
  assert.match(search, /: "gap-2"/);
});
