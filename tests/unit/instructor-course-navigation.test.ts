import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("la navigation formateur n’expose pas l’ancien écran Insights", async () => {
  const source = await readFile(
    path.join(root, "src/app/formateur/cours/[id]/_components/wizard.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /slug:\s*["']insights["']/);
});

test("la liste des cours contient son tableau large sur mobile", async () => {
  const source = await readFile(
    path.join(root, "src/app/formateur/cours/page.tsx"),
    "utf8",
  );
  assert.match(source, /min-w-0 max-w-full overflow-x-auto/);
});

test("les métadonnées de l’aperçu utilisent le contexte propriétaire", async () => {
  const source = await readFile(
    path.join(root, "src/app/cours/[slug]/page.tsx"),
    "utf8",
  );
  assert.match(source, /generateMetadata[\s\S]*searchParams/);
  assert.match(source, /getPublishedCourseBySlug\(slug, previewCtx\)/);
});
