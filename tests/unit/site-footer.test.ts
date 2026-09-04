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
  const newsletterSource = await readFile(
    path.join(root, "src/components/features/marketing/newsletter-form.tsx"),
    "utf8",
  );
  const styles = await readFile(
    path.join(root, "src/components/layout/site-footer.module.css"),
    "utf8",
  );

  const backgrounds = source.match(/\/images\/footer-slideshow\/[a-z-]+\.webp/g);
  assert.equal(backgrounds?.length, 5);
  for (const topic of [
    "artificial-intelligence",
    "solar-energy",
    "renewable-energy",
    "renovation",
    "digital-marketing",
  ]) {
    assert.match(source, new RegExp(`${topic}\\.webp`));
  }
  assert.match(source, /<Image[\s\S]*?alt=""[\s\S]*?fill[\s\S]*?sizes="100vw"/);
  assert.match(source, /bg-\[#031735\]\/82/);
  assert.match(styles, /animation: footer-background-cycle 150s linear infinite both/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(source, /<Logo width=\{170\} transparentBackground \/>/);
  assert.match(source, /Newsletter mensuelle/);
  assert.match(source, /<NewsletterForm/);
  assert.match(source, /source="footer"/);

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
  assert.match(newsletterSource, /aria-label="Inscription à la newsletter"/);
  assert.match(newsletterSource, /flex w-full min-w-0 items-center rounded-full/);
  assert.match(newsletterSource, /h-10 shrink-0 rounded-full/);
  assert.match(newsletterSource, /flex items-start gap-2 text-xs/);
});
