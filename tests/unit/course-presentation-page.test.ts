import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync("src/app/cours/[slug]/page.tsx", "utf8");
const accessNotice = readFileSync(
  "src/components/features/courses/course-access-notice.tsx",
  "utf8",
);
const curriculum = readFileSync(
  "src/components/features/courses/course-curriculum.tsx",
  "utf8",
);

test("la fiche formation reprend la navigation et la carte sticky de la maquette", () => {
  assert.match(page, /Navigation de la formation/);
  for (const anchor of ["#apercu", "#programme", "#formateur", "#avis", "#faq"]) {
    assert.match(page, new RegExp(anchor));
  }
  assert.match(page, /sticky top-24/);
  assert.match(page, /lg:hidden/);
  assert.match(page, /Attestation de fin de formation/);
});

test("les libellés publics utilisent apprenant et Quiz de validation", () => {
  const publicPresentation = `${page}\n${accessNotice}\n${curriculum}`;

  assert.match(publicPresentation, /apprenant/);
  assert.match(publicPresentation, /Quiz de validation/);
  assert.doesNotMatch(publicPresentation, /Avis des élèves/);
  assert.match(accessNotice, /Demander mon inscription/);
});

test("le programme conserve son accordéon accessible", () => {
  assert.match(curriculum, /aria-expanded=\{isOpen\}/);
  assert.match(curriculum, /onClick=\{\(\) => toggle\(section.id\)\}/);
  assert.match(curriculum, /Tout masquer/);
  assert.match(curriculum, /Tout afficher/);
});
