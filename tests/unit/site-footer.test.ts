import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("le footer public reste limité aux informations essentielles", async () => {
  const source = await readFile(
    path.join(root, "src/components/layout/site-footer.tsx"),
    "utf8",
  );

  assert.match(source, /footer-modern-building-construction\.webp/);
  assert.match(source, /bg-\[#031735\]\/88/);
  assert.match(source, /<Logo width=\{170\} \/>/);
  assert.doesNotMatch(source, /newsletter/i);

  for (const label of ["Catalogue", "À propos", "Contact", "Se connecter"]) {
    assert.match(source, new RegExp(`label: "${label}"`));
  }
  const essentialLinks = source.match(/const ESSENTIAL_LINKS = \[([\s\S]*?)\] as const;/)?.[1];
  assert.ok(essentialLinks);
  assert.equal((essentialLinks.match(/href:/g) ?? []).length, 4);
  assert.doesNotMatch(source, /href: "\/(categories|aide|credits|cookies)"|sort=/);

  for (const label of ["Mentions légales", "CGV", "Confidentialité"]) {
    assert.match(source, new RegExp(`label: "${label}"`));
  }
  assert.match(source, /BRAND\.address/);
  assert.match(source, /BRAND\.email/);
  assert.match(source, /BRAND\.phone/);
  assert.match(source, /BRAND\.mobile/);
  assert.match(source, /BRAND\.qualiopiLogoUrl/);
});
