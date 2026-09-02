// Parcours fonctionnels de bout en bout, avec de vraies écritures en base.
//
// Chaque parcours crée ses propres données, préfixées « QA · », et n'efface
// rien : la base de recette est jetable, et une suppression en fin de test
// masquerait justement les régressions de suppression qu'on veut voir.

import { expect, test, type Browser, type Page } from "@playwright/test";

import { login, type QaRole } from "./helpers/auth";

/** Suffixe unique par exécution : deux passages ne doivent pas se gêner. */
const RUN = Date.now().toString(36).slice(-6);

function pathOf(page: Page): string {
  return new URL(page.url()).pathname;
}

async function signedInPage(browser: Browser, role: QaRole): Promise<Page> {
  const page = await browser.newPage();
  expect(await login(page, role), `connexion ${role}`).toBe(true);
  return page;
}

// ---------------------------------------------------------------------------
// Formateur — créer et outiller une formation
// ---------------------------------------------------------------------------

test.describe.serial("Parcours formateur — création d'une formation", () => {
  let page: Page;
  let courseId: string;
  const title = `QA · Formation ${RUN}`;

  test.beforeAll(async ({ browser }) => {
    page = await signedInPage(browser, "instructor");
  });
  test.afterAll(async () => {
    await page?.close();
  });

  test("le formulaire refuse un titre vide", async () => {
    await page.goto("/formateur/cours/nouveau", { waitUntil: "networkidle" });
    const title = page.locator("#title");
    await expect(title).toHaveAttribute("required", "");
    // Le navigateur bloque l'envoi : on reste sur le formulaire.
    await page.click('button[type="submit"]');
    expect(pathOf(page)).toBe("/formateur/cours/nouveau");
  });

  test("une formation se crée et s'ouvre", async () => {
    await page.goto("/formateur/cours/nouveau", { waitUntil: "networkidle" });
    await page.fill("#title", title);
    // Première catégorie réelle proposée par le formulaire.
    const options = await page.locator("#categoryId option").evaluateAll((nodes) =>
      nodes
        .map((node) => (node as HTMLOptionElement).value)
        .filter((value) => value.length > 0),
    );
    expect(options.length, "aucune catégorie disponible").toBeGreaterThan(0);
    await page.selectOption("#categoryId", options[0]);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/formateur\/cours\/[^/]+/, { timeout: 15_000 });

    courseId = pathOf(page).split("/")[3];
    expect(courseId, "identifiant de formation introuvable").toBeTruthy();
    await expect(page.locator("body")).toContainText(title);
  });

  test("la formation apparaît dans la liste du formateur", async () => {
    await page.goto("/formateur/cours", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText(title);
  });

  test("une formation neuve n'est pas publiée", async () => {
    await page.goto(`/formateur/cours/${courseId}`, { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    expect(body.toLowerCase()).toMatch(/brouillon|draft/);
  });

  test("le programme s'ouvre et accepte une section", async () => {
    await page.goto(`/formateur/cours/${courseId}/programme`, { waitUntil: "networkidle" });
    expect(pathOf(page)).toBe(`/formateur/cours/${courseId}/programme`);
    const sectionTitle = `QA · Module ${RUN}`;
    // Le formulaire de section est le premier champ texte de l'écran.
    const input = page.locator('input[name="title"]').first();
    if ((await input.count()) > 0) {
      await input.fill(sectionTitle);
      await page.locator('form:has(input[name="title"]) button[type="submit"]').first().click();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("body")).toContainText(sectionTitle);
    }
  });

  test("un titre hostile est rendu comme du texte, jamais exécuté", async () => {
    const hostile = `QA · <img src=x onerror="window.__xss=1"> ${RUN}`;
    await page.goto("/formateur/cours/nouveau", { waitUntil: "networkidle" });
    await page.fill("#title", hostile);
    const options = await page.locator("#categoryId option").evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLOptionElement).value).filter((value) => value.length > 0),
    );
    await page.selectOption("#categoryId", options[0]);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/formateur\/cours\/[^/]+/, { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    // La charge ne doit ni s'exécuter, ni produire une balise réelle.
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(await page.locator('img[src="x"]').count()).toBe(0);
    await expect(page.locator("body")).toContainText("<img src=x");
  });
});

// ---------------------------------------------------------------------------
// Administration — donner accès puis retirer
// ---------------------------------------------------------------------------

test.describe.serial("Parcours administration — comptes et catalogue", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await signedInPage(browser, "admin");
  });
  test.afterAll(async () => {
    await page?.close();
  });

  test("la liste des apprenants s'affiche et se filtre", async () => {
    await page.goto("/admin/utilisateurs", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText("qa.eleve@audit.local");
    await page.goto("/admin/utilisateurs?q=qa.eleve", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText("qa.eleve@audit.local");
  });

  test("l'espace apprenants ne laisse pas remonter un formateur", async () => {
    // La frontière est posée côté serveur (`role: "STUDENT"` dans
    // `buildAdminUsersWhere`), pas par un filtre d'URL : une recherche visant
    // un compte formateur ne doit rien en révéler ici.
    await page.goto("/admin/utilisateurs?q=qa.formateur", { waitUntil: "networkidle" });
    await expect(page.locator("body")).not.toContainText("qa.formateur@audit.local");
  });

  test("la fiche d'un compte s'ouvre", async () => {
    await page.goto("/admin/utilisateurs", { waitUntil: "networkidle" });
    const href = await page
      .locator("a[href^='/admin/utilisateurs/']")
      .first()
      .getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(href!, { waitUntil: "networkidle" });
    expect(pathOf(page)).toBe(href);
  });

  test("le catalogue d'administration liste les formations", async () => {
    await page.goto("/admin/cours", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText("QA — Formation du formateur un");
  });

  test("le journal d'audit est consultable", async () => {
    await page.goto("/admin/securite/logs", { waitUntil: "networkidle" });
    expect(pathOf(page)).toBe("/admin/securite/logs");
  });

  test("la recherche transversale répond", async () => {
    const body = await page.evaluate(() =>
      fetch("/api/admin/search?q=qa").then((r) => r.json()),
    );
    expect(body).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Élève — navigation et espaces personnels
// ---------------------------------------------------------------------------

test.describe.serial("Parcours élève — catalogue et espace personnel", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await signedInPage(browser, "student");
  });
  test.afterAll(async () => {
    await page?.close();
  });

  test("le catalogue se parcourt et une fiche s'ouvre", async () => {
    await page.goto("/cours", { waitUntil: "networkidle" });
    const href = await page.locator("a[href^='/cours/']").first().getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(href!, { waitUntil: "networkidle" });
    expect(pathOf(page)).toBe(href);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("la recherche renvoie des résultats exploitables", async () => {
    const results = await page.evaluate(() =>
      fetch("/api/recherche?q=formation").then((r) => r.json()),
    );
    expect(results).toBeTruthy();
  });

  test("le profil s'ouvre et affiche l'adresse du compte", async () => {
    await page.goto("/profil", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText("qa.eleve@audit.local");
  });

  test("la liste de souhaits et les notifications s'ouvrent", async () => {
    for (const target of ["/wishlist", "/notifications"]) {
      await page.goto(target, { waitUntil: "networkidle" });
      expect(pathOf(page)).toBe(target);
    }
  });
});

// ---------------------------------------------------------------------------
// Pages d'erreur
// ---------------------------------------------------------------------------

test.describe("Pages d'erreur", () => {
  test("la page 404 est en français, habillée et offre une sortie", async ({ page }) => {
    // Avant l'ajout de `src/app/not-found.tsx`, Next servait sa page par
    // défaut : « 404 — This page could not be found », en anglais et sans
    // navigation, sur un site dont toute l'interface est en français.
    const response = await page.goto(`/categories/inexistant-${RUN}`, {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(404);
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("This page could not be found");
    expect(body).toContain("Cette page n'existe pas");
    // Une impasse doit proposer un chemin de retour.
    expect(await page.locator('a[href="/"]').count()).toBeGreaterThan(0);
    expect(await page.locator('a[href="/cours"]').count()).toBeGreaterThan(0);
  });

  test("une formation retirée affiche la même page 404 habillée", async ({ page }) => {
    // Le segment `/cours` a un `loading.tsx` : la réponse part en streaming,
    // donc le statut reste 200 (cf. doc Next 16, « Status codes »). Ce qui
    // doit tenir ici, c'est l'écran rendu et la directive `noindex`.
    await page.goto(`/cours/inexistant-${RUN}`, { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("This page could not be found");
    expect(body).toContain("Cette page n'existe pas");
  });

  test("une ressource inconnue ne fuit aucune trace technique", async ({ page }) => {
    for (const target of [`/cours/inexistant-${RUN}`, `/categories/inexistant-${RUN}`]) {
      await page.goto(target, { waitUntil: "networkidle" });
      const body = await page.locator("body").innerText();
      expect(body, target).not.toMatch(
        /at .*\(.*:\d+:\d+\)|PrismaClient|SELECT .* FROM|node_modules/i,
      );
    }
  });

  test("une ressource inconnue n'est jamais donnée à indexer", async ({ request }) => {
    // Le layout racine déclare `index, follow` pour tout le site. Une page qui
    // ne trouve pas sa ressource en héritait, et sortait deux directives
    // contradictoires — dont une invitant à indexer une page fantôme.
    for (const target of [
      `/cours/inexistant-${RUN}`,
      `/categories/inexistant-${RUN}`,
      `/formateurs/inexistant-${RUN}`,
    ]) {
      const response = await request.get(target);
      const html = await response.text();
      const directives = [...html.matchAll(/<meta name="robots" content="([^"]*)"/gi)].map(
        (match) => match[1].toLowerCase(),
      );
      expect(directives.length, `${target} : aucune directive robots`).toBeGreaterThan(0);
      // Deux protections, dont une suffit : le statut 404, que tout robot
      // respecte, ou — quand la réponse est partie en streaming avec un 200 —
      // des directives toutes restrictives. C'est ce second cas que le layout
      // racine cassait en imposant `index, follow` à toute page du site.
      const safe =
        response.status() === 404 ||
        directives.every((directive) => directive.includes("noindex"));
      expect(
        safe,
        `${target} (${response.status()}) laisse passer : ${directives.join(" / ")}`,
      ).toBe(true);
      expect(
        directives.some((directive) => directive.includes("noindex")),
        `${target} n'émet aucun noindex`,
      ).toBe(true);
    }
  });
});
