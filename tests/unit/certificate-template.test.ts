import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  formatCertificateDate,
  getAiducaTrainingLocation,
} from "../../src/lib/certificate-template";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("les champs de l’attestation sont formatés avec les données de formation", () => {
  assert.equal(formatCertificateDate(new Date("2026-08-20T12:00:00Z")), "20 août 2026");
  assert.equal(getAiducaTrainingLocation(), "92120 Montrouge");
});

test("l’aperçu conserve MODÈLE et le PDF définitif ne le dessine pas", async () => {
  const [preview, pdf] = await Promise.all([
    source("src/components/features/learning/certificate-preview.tsx"),
    source("src/lib/pdf-certificate.ts"),
  ]);

  assert.match(preview, /showModel \? <p className=\{styles\.model\}>MODÈLE<\/p>/);
  assert.doesNotMatch(pdf, /draw(?:Centered|Text)\([^\n]*MODÈLE/);
  assert.match(pdf, /A4 paysage/);
});

test("le parcours propose la génération, l’aperçu et le téléchargement PDF", async () => {
  const page = await source("src/app/apprentissage/[slug]/page.tsx");

  assert.match(page, /Générer l’attestation/);
  assert.match(page, /Aperçu de l’attestation/);
  assert.match(page, /Télécharger en PDF/);
  assert.match(page, /showModel=\{!certificate\}/);
  assert.match(page, /formatDurationFromSeconds\(course\.durationSeconds\)/);
  assert.match(page, /startDate:\s*certificate\?\.registration\?\.session\.startDate \?\? enrollment\.enrolledAt/);
  // Les dates de l'action viennent de la session dès que l'attestation y est
  // rattachée ; l'inscription au cours ne sert plus que de repli.
  assert.match(page, /certificate\?\.registration\?\.session\.endDate/);
  assert.match(page, /enrollment\.completedAt/);
});

