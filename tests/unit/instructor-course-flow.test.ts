import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("la création d’une leçon ouvre immédiatement sa page d’édition", async () => {
  const [action, form, programme] = await Promise.all([
    source("src/server/actions/curriculum.ts"),
    source("src/components/features/instructor/lesson-create-form.tsx"),
    source("src/app/formateur/cours/[id]/programme/page.tsx"),
  ]);

  assert.match(action, /lessonId: createdLesson\.id/);
  assert.match(
    form,
    /router\.push\(`\/formateur\/cours\/\$\{courseId\}\/lecons\/\$\{state\.lessonId\}`\)/,
  );
  assert.match(
    programme,
    /<LessonCreateForm courseId=\{course\.id\} sectionId=\{section\.id\} \/>/,
  );
});

test("l’édition revient au programme sauf pendant une configuration dédiée", async () => {
  const form = await source(
    "src/components/features/instructor/lesson-edit-form.tsx",
  );

  assert.match(
    form,
    /if \(!state\.success \|\| type === "QUIZ" \|\| type === "PRESENTATION"\) return/,
  );
  assert.match(form, /router\.push\(returnHref\)/);
  assert.match(form, /<Alert variant="success">/);
});

test("un quiz valide et la dernière étape offrent des sorties explicites", async () => {
  const [quiz, seo, lessonPage, seoPage] = await Promise.all([
    source("src/components/features/instructor/quiz-editor.tsx"),
    source("src/components/features/instructor/course-seo-form.tsx"),
    source("src/app/formateur/cours/[id]/lecons/[lessonId]/page.tsx"),
    source("src/app/formateur/cours/[id]/seo/page.tsx"),
  ]);

  assert.match(quiz, /Valider le quiz et revenir au programme/);
  assert.match(quiz, /!quiz \|\| quiz\.questions\.length === 0/);
  assert.match(
    lessonPage,
    /returnHref=\{`\/formateur\/cours\/\$\{id\}\/programme`\}/,
  );
  assert.match(seo, /Enregistrer la formation/);
  assert.match(seo, /Votre formation a été enregistrée avec succès\./);
  assert.match(seo, /Retour au programme/);
  assert.match(seo, /Voir l’aperçu/);
  assert.match(
    seoPage,
    /previewHref=\{`\/cours\/\$\{course\.slug\}\?preview=1`\}/,
  );
});
