import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = readFileSync("src/app/cours/page.tsx", "utf8");
const categoryPage = readFileSync("src/app/categories/[slug]/page.tsx", "utf8");
const sidebar = readFileSync(
  "src/components/features/courses/course-filter-sidebar.tsx",
  "utf8",
);
const filterBar = readFileSync(
  "src/components/features/courses/course-filter-bar.tsx",
  "utf8",
);
const drawer = readFileSync(
  "src/components/features/courses/course-filter-drawer.tsx",
  "utf8",
);
const mobileBar = readFileSync(
  "src/components/features/courses/course-mobile-filter-bar.tsx",
  "utf8",
);

test("le catalogue active le mode de filtre limité à la catégorie", () => {
  assert.match(catalog, /<CourseFilterBar[\s\S]*?categoryOnly/);
  assert.match(catalog, /<CourseMobileFilterBar[\s\S]*?categoryOnly/);
  assert.doesNotMatch(sidebar, /title="(?:Note|Niveau|Durée)"/);
  assert.doesNotMatch(sidebar, /RATING_THRESHOLDS|COURSE_LEVELS|DURATION_FILTERS/);
});

test("les variantes tablette et mobile masquent les filtres avancés dans ce mode", () => {
  assert.match(filterBar, /categoryOnly\?: boolean/);
  assert.match(filterBar, /!categoryOnly \? \(\s*<FilterChip\s*label="Niveau"/);
  assert.match(filterBar, /!categoryOnly \? \(\s*<FilterChip\s*label="Durée"/);
  assert.match(filterBar, /!categoryOnly \? \(\s*<FilterChip\s*label="Note"/);
  assert.match(drawer, /title=\{categoryOnly \? "Catégorie" : "Tous les filtres"\}/);
  assert.match(mobileBar, /\{categoryOnly \? "Catégorie" : "Filtres"\}/);
});

test("les anciens paramètres invisibles sont retirés lors de l'application", () => {
  for (const key of ["level", "duration", "rating", "price"]) {
    assert.match(filterBar, new RegExp(`next\\.delete\\("${key}"\\)`));
    assert.match(drawer, new RegExp(`next\\.delete\\("${key}"\\)`));
    assert.match(sidebar, new RegExp(`next\\.delete\\("${key}"\\)`));
  }
});

test("la page d'une catégorie conserve les filtres avancés existants", () => {
  assert.doesNotMatch(categoryPage, /categoryOnly/);
  assert.match(filterBar, /categoryOnly = false/);
  assert.match(drawer, /categoryOnly = false/);
  assert.match(mobileBar, /categoryOnly = false/);
});
