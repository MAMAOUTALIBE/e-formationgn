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

test("le hero utilise uniquement l’image propre à la formation et conserve son fond actuel par défaut", () => {
  assert.match(page, /course\.heroBackgroundUrl/);
  assert.match(page, /bg-cover bg-center/);
  assert.match(page, /bg-black\/55/);
  assert.match(page, /bg-\[linear-gradient\(125deg,#f1faf6_0%,#f8fcfa_72%,#edf8f2_100%\)\]/);
});

test("les libellés publics utilisent apprenant", () => {
  const publicPresentation = `${page}\n${accessNotice}\n${curriculum}`;

  assert.match(publicPresentation, /apprenant/);
  assert.doesNotMatch(publicPresentation, /Avis des élèves/);
  assert.match(accessNotice, /Demander mon inscription/);
});

test("le programme présente uniquement des cartes de section statiques", () => {
  assert.match(curriculum, /SECTION_ACCENTS/);
  assert.match(curriculum, /border-l-\[6px\]/);
  assert.match(curriculum, /borderLeftColor: accent\.borderColor/);
  assert.match(curriculum, /section\.title/);
  assert.doesNotMatch(curriculum, /aria-expanded|onClick|ChevronDown/);
  assert.doesNotMatch(curriculum, /Tout masquer|Tout afficher/);
  assert.doesNotMatch(curriculum, /lesson\.title|videoDurationSeconds|formatLessonDuration/);
});
