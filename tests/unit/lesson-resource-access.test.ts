import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { lessonResourceHref } from "../../src/lib/resource-file";

const root = process.cwd();
const read = (relative: string) => readFile(path.join(root, relative), "utf8");

test("l'adresse d'une ressource passe par la route contrôlée", () => {
  assert.equal(
    lessonResourceHref("les_1", "res_1"),
    "/api/lecons/les_1/ressource/res_1",
  );
  assert.equal(
    lessonResourceHref("les_1", "res_1", true),
    "/api/lecons/les_1/ressource/res_1?dl=1",
  );
  // Les identifiants sont échappés : ils viennent de la base, mais rien
  // n'oblige un identifiant à rester alphanumérique pour toujours.
  assert.equal(
    lessonResourceHref("a/b", "c d"),
    "/api/lecons/a%2Fb/ressource/c%20d",
  );
});

test("la route de ressource vérifie session, propriété et inscription", async () => {
  const source = await read(
    "src/app/api/lecons/[lessonId]/ressource/[resourceId]/route.ts",
  );
  assert.match(source, /await auth\(\)/);
  assert.match(source, /status: 401/);
  assert.match(source, /status: 403/);
  assert.match(source, /prisma\.enrollment\.findUnique/);
  // Un formateur n'est pas inscrit à son propre cours : le tester par la
  // seule inscription lui fermerait ses propres documents.
  assert.match(source, /course\.instructorId === userId/);
  assert.match(source, /isAdminRole/);
  // La ressource est cherchée AVEC sa leçon : sinon un identifiant suffirait
  // à la lire depuis n'importe quelle leçon accessible.
  assert.match(source, /where: \{ id: resourceId, lessonId \}/);
});

test("la route publique /uploads refuse le préfixe des supports de cours", async () => {
  const source = await read("src/app/uploads/[...path]/route.ts");
  assert.match(source, /RESOURCE_PREFIX = "resources"/);
  assert.match(source, /segments\[0\] === RESOURCE_PREFIX/);
});

test("aucun écran ne lie encore l'adresse de stockage d'une ressource", async () => {
  const [stage, tab, manager] = await Promise.all([
    read("src/components/features/learning/lesson-resource-stage.tsx"),
    read("src/app/apprentissage/[slug]/lecons/[lessonId]/page.tsx"),
    read("src/components/features/instructor/lesson-resources-manager.tsx"),
  ]);
  for (const source of [stage, tab, manager]) {
    assert.match(source, /lessonResourceHref/);
  }
  // `href={resource.url}` était le lien direct vers le stockage.
  assert.doesNotMatch(tab, /href=\{resource\.url\}/);
  assert.doesNotMatch(manager, /href=\{resource\.url\}/);
});

test("le proxy laisse la route répondre en JSON plutôt qu'en redirection", async () => {
  const source = await read("src/auth.config.ts");
  assert.match(source, /pathname\.startsWith\("\/api\/lecons\/"\) *\) *return true/);
});

test("le programme permet de gérer les ressources sur chaque carte de leçon", async () => {
  const [programme, cards, query] = await Promise.all([
    read("src/app/formateur/cours/[id]/programme/page.tsx"),
    read("src/components/features/instructor/program-lessons-list.tsx"),
    read("src/server/queries/instructor.ts"),
  ]);

  // Le programme doit recevoir les ressources réelles, pas un compteur
  // reconstruit côté client qui deviendrait faux après un téléversement.
  assert.match(query, /include: \{ resources: \{ orderBy: \{ createdAt: "asc" \} \} \}/);
  assert.match(programme, /<ProgramLessonsList/);
  assert.match(programme, /lesson\.resources\.map/);
  assert.match(programme, /sectionResourceCount/);

  assert.match(cards, /Ajouter des ressources/);
  assert.match(cards, /Ressources \(\$\{resourceCount\}\)/);
  assert.match(cards, /<LessonResourcesManager/);
  assert.match(cards, /openLessonId/);
  assert.match(cards, /aria-expanded=\{resourcesOpen\}/);
});

test("les cartes de leçon restent blanches dans tous les thèmes", async () => {
  const cards = await read(
    "src/components/features/instructor/program-lessons-list.tsx",
  );

  assert.match(cards, /bg-white/);
  assert.match(cards, /dark:bg-white/);
  assert.match(cards, /\[color-scheme:light\]/);
  assert.match(cards, /\[--foreground:var\(--neutral-900\)\]/);
  assert.doesNotMatch(cards, /dark:bg-slate-950/);
});

test("la carte de ressources est l'unique interface d'ajout d'une leçon", async () => {
  const [createForm, editForm, editPage, actions] = await Promise.all([
    read("src/components/features/instructor/lesson-create-form.tsx"),
    read("src/components/features/instructor/lesson-edit-form.tsx"),
    read("src/app/formateur/cours/[id]/lecons/[lessonId]/page.tsx"),
    read("src/server/actions/curriculum.ts"),
  ]);

  assert.doesNotMatch(createForm, /<option value="RESOURCE">/);
  assert.doesNotMatch(editForm, /label="URL de la ressource"/);
  assert.doesNotMatch(editForm, /label="Nom de fichier \(optionnel\)"/);
  assert.match(editForm, /Ressource \(ancien format\)/);
  assert.match(editForm, /type="hidden" name="resourceUrl"/);
  assert.match(editPage, /<LessonResourcesManager/);
  assert.match(actions, /parsed\.data\.type === "RESOURCE"/);
  assert.match(actions, /lesson\.type !== "RESOURCE"/);
  assert.match(actions, /RETIRED_RESOURCE_TYPE_MESSAGE/);
});

test("le lecteur montre les ressources modernes et historiques sans imbriquer les actions", async () => {
  const [page, sidebar] = await Promise.all([
    read("src/app/apprentissage/[slug]/lecons/[lessonId]/page.tsx"),
    read("src/components/features/learning/learning-sidebar.tsx"),
  ]);

  // L'ancien code ne regardait que `resourceUrl` et rendait invisibles dans
  // la barre latérale les pièces jointes stockées dans `lesson.resources`.
  assert.match(page, /resources: l\.resources\.map/);
  assert.match(page, /legacyResource: l\.resourceUrl/);
  assert.match(page, /lesson\.resources\.length \+ \(lesson\.resourceUrl \? 1 : 0\)/);
  assert.doesNotMatch(page, /hasResource: Boolean\(l\.resourceUrl\)/);

  assert.match(sidebar, /resourceCount > 0/);
  assert.match(sidebar, /aria-controls=\{resourcesPanelId\}/);
  assert.match(sidebar, /lessonResourceHref\(lesson\.id, resource\.id, true\)/);
  assert.match(sidebar, /openResourcesLessonId/);
});

test("le bouton de ressources ne partage jamais la ligne du titre", async () => {
  const sidebar = await read(
    "src/components/features/learning/learning-sidebar.tsx",
  );

  const lessonLinkEnd = sidebar.indexOf("</Link>", sidebar.indexOf("aria-current="));
  const resourceButton = sidebar.indexOf("<button", lessonLinkEnd);

  assert.ok(lessonLinkEnd > -1);
  assert.ok(resourceButton > lessonLinkEnd);
  assert.match(sidebar, /mt-2\.5 flex justify-end pl-7/);
  assert.match(sidebar, /whitespace-normal break-words leading-5 \[overflow-wrap:anywhere\]/);
  assert.doesNotMatch(sidebar, /cn\("truncate", isActive/);
  assert.match(sidebar, /border-violet-500/);
  assert.match(sidebar, /<FolderOpen[^>]+aria-hidden \/>/);
  assert.match(sidebar, /<span>Ressources<\/span>/);
  assert.match(sidebar, /max-\[379px\]:w-full/);
});
