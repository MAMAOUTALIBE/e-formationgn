import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("les catégories publiées utilisent leurs images sans remplacer leurs données", () => {
  const source = readFileSync(
    "src/components/features/courses/category-card.tsx",
    "utf8",
  );

  for (const image of [
    "developpement.webp",
    "isolation.webp",
    "pac.webp",
    "photovoltaique.webp",
    "electricite.webp",
    "marketing.webp",
    "developpement-personnel.webp",
  ]) {
    assert.match(source, new RegExp(`/images/categories/${image}`));
  }

  assert.match(source, /CATEGORY_BACKGROUNDS\[category\.slug\]/);
  assert.match(source, /category\.name/);
  assert.match(source, /category\.description/);
  assert.match(source, /category\.iconName/);
  assert.match(source, /category\._count\?\.courses/);
  assert.match(source, /<Image[\s\S]*?alt=""[\s\S]*?fill/);
  assert.match(source, /<CategoryPattern variant=\{variant\}/);
});
