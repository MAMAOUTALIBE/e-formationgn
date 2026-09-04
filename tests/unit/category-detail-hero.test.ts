import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const categoryPage = readFileSync("src/app/categories/[slug]/page.tsx", "utf8");

test("le hero de catégorie reprend la géométrie du catalogue avec un fond thématique", () => {
  assert.match(categoryPage, /getCourseDomainBackground\(category\.slug\)/);
  assert.match(categoryPage, /<Image[\s\S]*?src=\{heroBackground\}[\s\S]*?fill/);
  assert.match(categoryPage, /relative isolate overflow-hidden/);
  assert.match(categoryPage, /space-y-6 py-8 sm:py-12 lg:py-16/);
  assert.match(categoryPage, /linear-gradient\(90deg,rgba\(255,255,255,0\.98\)/);
  assert.match(categoryPage, /<CourseSearchBar integrated \/>/);
});

test("le hero conserve les textes dynamiques de la catégorie", () => {
  assert.match(categoryPage, /\{category\.name\}/);
  assert.match(categoryPage, /\{category\.description\}/);
  assert.match(categoryPage, /total\.toLocaleString\("fr-FR"\)/);
  assert.match(categoryPage, /label: "Accueil"/);
  assert.match(categoryPage, /label: "Catégories"/);
});
