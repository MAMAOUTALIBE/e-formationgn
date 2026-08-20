import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { BRAND } from "../../src/lib/brand";

const read = (path: string) => readFileSync(path, "utf8");

test("l’identité institutionnelle Aiduca est centralisée et complète", () => {
  assert.equal(BRAND.name, "Aiduca");
  assert.equal(BRAND.email, "info@aiduca.fr");
  assert.match(BRAND.address, /92120 Montrouge/i);
  assert.equal(BRAND.siren, "523 611 523");
  assert.equal(BRAND.activityDeclaration, "11922091192");
  assert.equal(BRAND.qualiopiCertificate, "FP 2020/0005-6");
  assert.equal(BRAND.qualiopiValidUntil, "20 octobre 2027");
  assert.match(BRAND.tagline, /formations professionnelles/i);
  assert.doesNotMatch(BRAND.tagline, /bâtiment/i);
});

test("les surfaces de marque principales n’affichent plus l’ancienne identité", () => {
  const sources = [
    "src/components/branding/logo.tsx",
    "src/components/layout/site-header.tsx",
    "src/components/layout/site-footer.tsx",
    "src/app/layout.tsx",
    "src/app/api/og/route.tsx",
    "src/app/robots.ts",
    "src/app/sitemap.ts",
    "src/app/formateurs/[code]/page.tsx",
    "src/components/features/admin/role-manager.tsx",
    "src/lib/cms.ts",
    "src/lib/email/templates.ts",
    "src/lib/pdf-certificate.ts",
    "public/manifest.webmanifest",
  ].map(read).join("\n");

  assert.doesNotMatch(sources, /Gandal/);
  assert.doesNotMatch(sources, /gandal\.org/);
  assert.match(sources, /Aiduca/);
  assert.match(sources, /Attestation de fin de formation/);
  assert.match(sources, /FP 2020\/0005-6/);
});
