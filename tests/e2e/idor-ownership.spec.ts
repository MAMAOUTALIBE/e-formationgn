// Cloisonnement horizontal : un compte ne doit pas atteindre les ressources
// d'un autre compte de même rôle (IDOR).
//
// Le contrôle porte sur l'identifiant en clair dans l'URL — c'est le vecteur
// réel : l'interface ne propose jamais ces liens, mais rien n'empêche de les
// composer à la main.

import { expect, test, type Browser, type Page } from "@playwright/test";

import { login, QA_COURSES, type QaRole } from "./helpers/auth";

function pathOf(page: Page): string {
  return new URL(page.url()).pathname;
}

async function signedInPage(browser: Browser, role: QaRole): Promise<Page> {
  const page = await browser.newPage();
  expect(await login(page, role), `connexion ${role}`).toBe(true);
  return page;
}

/** Identifiant interne d'une formation, lu depuis l'espace de son propriétaire. */
async function courseIdOf(page: Page, slug: string): Promise<string> {
  await page.goto("/formateur/cours", { waitUntil: "networkidle" });
  const hrefs = await page.locator("a[href^='/formateur/cours/']").evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href") ?? ""),
  );
  const ids = [
    ...new Set(
      hrefs
        .map((href) => href.split("/")[3])
        .filter((id): id is string => Boolean(id) && id !== "nouveau"),
    ),
  ];
  expect(ids.length, `aucune formation trouvée pour ${slug}`).toBeGreaterThan(0);
  return ids[0];
}

test.describe.serial("IDOR — formations entre formateurs", () => {
  let owner: Page;
  let other: Page;
  let ownedCourseId: string;

  test.beforeAll(async ({ browser }) => {
    owner = await signedInPage(browser, "instructor");
    ownedCourseId = await courseIdOf(owner, QA_COURSES.instructor);
    other = await signedInPage(browser, "instructor2");
  });

  test.afterAll(async () => {
    await owner?.close();
    await other?.close();
  });

  test("le propriétaire ouvre bien sa formation", async () => {
    await owner.goto(`/formateur/cours/${ownedCourseId}`);
    expect(pathOf(owner)).toBe(`/formateur/cours/${ownedCourseId}`);
  });

  test("un autre formateur n'ouvre pas cette formation", async () => {
    const targets = [
      `/formateur/cours/${ownedCourseId}`,
      `/formateur/cours/${ownedCourseId}/programme`,
      `/formateur/cours/${ownedCourseId}/eleves`,
      `/formateur/cours/${ownedCourseId}/resultats`,
      `/formateur/cours/${ownedCourseId}/seo`,
      `/formateur/cours/${ownedCourseId}/annonces`,
    ];
    for (const target of targets) {
      const response = await other.goto(target);
      const status = response?.status() ?? 0;
      const landed = pathOf(other);
      // Refus acceptable : 403/404, ou redirection hors de la ressource.
      const refused = status === 403 || status === 404 || landed !== target;
      expect(refused, `${target} a répondu ${status} et a affiché ${landed}`).toBe(true);
    }
  });

  test("un élève n'ouvre aucun écran de formation d'un formateur", async ({ browser }) => {
    const student = await signedInPage(browser, "student");
    const response = await student.goto(`/formateur/cours/${ownedCourseId}`);
    const status = response?.status() ?? 0;
    expect(
      status === 403 || status === 404 || pathOf(student) !== `/formateur/cours/${ownedCourseId}`,
    ).toBe(true);
    await student.close();
  });
});

test.describe.serial("Accès au contenu — inscription requise", () => {
  let student: Page;

  test.beforeAll(async ({ browser }) => {
    student = await signedInPage(browser, "student");
  });
  test.afterAll(async () => {
    await student?.close();
  });

  test("l'espace d'apprentissage d'une formation non suivie ne s'ouvre pas", async () => {
    const target = `/apprentissage/${QA_COURSES.instructor}`;
    const response = await student.goto(target, { waitUntil: "networkidle" });
    const status = response?.status() ?? 0;
    expect(
      status === 403 || status === 404 || pathOf(student) !== target,
      `${target} a répondu ${status} et a affiché ${pathOf(student)}`,
    ).toBe(true);
    // Et aucun contenu de leçon ne doit avoir été rendu au passage.
    expect(await student.locator("a[href*='/lecons/']").count()).toBe(0);
  });

  test("la fiche publique de la formation reste consultable", async () => {
    const target = `/cours/${QA_COURSES.instructor}`;
    const response = await student.goto(target, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
    expect(pathOf(student)).toBe(target);
  });

  test("une ressource de leçon inconnue ne renvoie jamais de fichier", async () => {
    const status = await student.evaluate(() =>
      fetch("/api/lecons/inexistant/ressource/inexistant").then((r) => r.status),
    );
    // 401/403/404 selon la garde qui parle en premier — jamais 200.
    expect(status).not.toBe(200);
    expect([400, 401, 403, 404]).toContain(status);
  });
});
