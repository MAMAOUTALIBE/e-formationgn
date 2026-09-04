import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  COURSE_DOMAIN_BACKGROUNDS,
  resolveCourseCardBackground,
} from "../../src/lib/courses/domain-backgrounds";

const card = readFileSync(
  "src/components/features/courses/course-card.tsx",
  "utf8",
);
const listCard = readFileSync(
  "src/components/features/courses/course-card-list.tsx",
  "utf8",
);

test("chaque domaine connu impose son visuel IA aux cartes de formation", () => {
  assert.equal(
    resolveCourseCardBackground("developpement", "/ancienne-image.jpg"),
    "/images/categories/developpement.webp",
  );
  assert.equal(
    resolveCourseCardBackground("marketing", "/ancienne-image.jpg"),
    "/images/categories/marketing.webp",
  );
  assert.equal(
    resolveCourseCardBackground("developpement-personnel", null),
    "/images/categories/developpement-personnel.webp",
  );
  assert.equal(Object.keys(COURSE_DOMAIN_BACKGROUNDS).length >= 7, true);
});

test("une catégorie sans visuel IA conserve sa miniature personnalisée", () => {
  assert.equal(
    resolveCourseCardBackground("domaine-futur", "/miniature-metier.webp"),
    "/miniature-metier.webp",
  );
  assert.equal(resolveCourseCardBackground("domaine-futur", null), null);
});

test("les vues grille et liste utilisent le même résolveur de domaine", () => {
  for (const source of [card, listCard]) {
    assert.match(source, /resolveCourseCardBackground\(/);
    assert.match(source, /src=\{backgroundImage\}/);
  }
});
