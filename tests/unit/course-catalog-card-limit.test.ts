import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  COURSES_PER_PAGE,
  courseFiltersSchema,
} from "../../src/lib/validators/courses";

const catalog = readFileSync("src/app/cours/page.tsx", "utf8");
const queries = readFileSync("src/server/queries/courses.ts", "utf8");

test("le catalogue est limité à huit cartes avant l'action Voir tout", () => {
  assert.equal(COURSES_PER_PAGE, 8);
  assert.match(catalog, /take: showAll \? null : COURSES_PER_PAGE/);
  assert.match(catalog, /total > COURSES_PER_PAGE/);
  assert.match(catalog, /Voir toutes les formations →/);
});

test("le mode Voir tout est validé et retire la limite serveur", () => {
  assert.equal(courseFiltersSchema.parse({ view: "all" }).view, "all");
  assert.equal(courseFiltersSchema.parse({ view: "invalid" }).view, undefined);
  assert.match(queries, /params\.take === null \? undefined/);
  assert.match(queries, /typeof take === "number"[\s\S]*?Prisma\.empty/);
});

test("le lien Voir tout conserve les critères mais revient à la première page", () => {
  assert.match(catalog, /next\.delete\("page"\)/);
  assert.match(catalog, /next\.set\("view", "all"\)/);
});
