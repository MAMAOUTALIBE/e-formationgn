// Recette des cloisonnements entre rôles — élève, formateur, administration.
//
// Deux barrières se vérifient ici, et il faut les deux : la garde de routage
// (`authConfig.callbacks.authorized`) qui empêche d'afficher l'écran, et la
// garde serveur de chaque route API, seule à tenir quand l'appel arrive sans
// passer par l'interface.
//
// Chaque rôle ne se connecte qu'une fois, en mode `serial` sur une page
// partagée : la connexion est plafonnée à 10 essais par quart d'heure et par
// couple (IP, compte), et une reconnexion par cas de test épuiserait ce budget
// — les échecs qui en résulteraient ne diraient rien du code testé.

import { expect, test, type Browser, type Page } from "@playwright/test";

import { login, QA_ACCOUNTS, QA_PASSWORD, type QaRole } from "./helpers/auth";

/**
 * Écrans du volet financier, retirés de la plateforme au niveau du proxy
 * (`src/proxy.ts`, REMOVED_PAGES). Ils répondent 404 quel que soit le rôle :
 * on l'affirme ici pour qu'une réactivation involontaire se voie.
 */
const REMOVED_PAGES = [
  "/panier",
  "/admin/finances",
  "/admin/finances/transactions",
  "/admin/commissions",
  "/admin/codes-promo",
  "/admin/marketing/promotions",
  "/admin/marketing/codes-promo",
  "/admin/marketing/affiliation",
  "/admin/parametres/commerce",
  "/admin/parametres/paiements",
  "/admin/support/litiges",
  "/formateur/paiements",
  "/formateur/codes-promo",
  "/formateur/affiliation",
];

/** API du même volet financier — répondent 410 Gone. */
const REMOVED_APIS = ["/api/formateur/ventes", "/api/admin/transactions-csv"];

/** Écrans actifs réservés à l'espace formateur. */
const INSTRUCTOR_PAGES = [
  "/formateur",
  "/formateur/cours",
  "/formateur/cours/nouveau",
  "/formateur/questions",
  "/formateur/avis",
  "/formateur/classes-virtuelles",
];

/** Écrans actifs réservés à l'administration. */
const ADMIN_PAGES = [
  "/admin",
  "/admin/utilisateurs",
  "/admin/cours",
  "/admin/categories",
  "/admin/securite",
  "/admin/securite/logs",
  "/admin/securite/roles",
  "/admin/moderation",
  "/admin/marketing",
  "/admin/parametres",
  "/admin/support",
  "/admin/support/tickets",
  "/admin/analytics",
  "/admin/formations",
  "/admin/societes",
  "/admin/equipe",
  "/admin/classes-virtuelles",
  "/admin/assistant",
  "/admin/assistant/sources",
];

/** Espaces privés d'un compte élève. */
const STUDENT_PAGES = ["/apprentissage", "/profil", "/notifications", "/wishlist"];

/** API d'administration encore actives. */
const ADMIN_APIS = ["/api/admin/search?q=qa", "/api/admin/live-feed"];

function pathOf(page: Page): string {
  return new URL(page.url()).pathname;
}

/** Statut HTTP d'un appel `fetch` émis depuis la session de la page. */
function fetchStatus(page: Page, url: string): Promise<number> {
  return page.evaluate((target) => fetch(target).then((r) => r.status), url);
}

/** Ouvre une page déjà connectée pour le rôle demandé. */
async function signedInPage(browser: Browser, role: QaRole): Promise<Page> {
  const page = await browser.newPage();
  const ok = await login(page, role);
  expect(
    ok,
    `Connexion ${role} impossible — lancez « npx tsx scripts/seed-qa-accounts.ts »`,
  ).toBe(true);
  return page;
}

// ---------------------------------------------------------------------------
// Volet financier retiré
// ---------------------------------------------------------------------------

test.describe("Volet financier — retiré de la plateforme", () => {
  for (const path of REMOVED_PAGES) {
    test(`${path} répond 404`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(404);
    });
  }

  for (const path of REMOVED_APIS) {
    test(`${path} répond 410`, async ({ request }) => {
      expect((await request.get(path)).status()).toBe(410);
    });
  }
});

// ---------------------------------------------------------------------------
// Visiteur anonyme
// ---------------------------------------------------------------------------

test.describe("Cloisonnement — visiteur anonyme", () => {
  for (const path of [...INSTRUCTOR_PAGES, ...ADMIN_PAGES, ...STUDENT_PAGES]) {
    test(`anonyme sur ${path} est renvoyé vers /connexion`, async ({ page }) => {
      await page.goto(path);
      expect(pathOf(page)).toBe("/connexion");
      // Le retour doit être mémorisé, sinon la connexion perd la destination.
      expect(page.url()).toContain("callbackUrl");
    });
  }

  test("les API d'administration refusent l'anonyme", async ({ request }) => {
    for (const endpoint of ADMIN_APIS) {
      const status = (await request.get(endpoint)).status();
      expect([401, 403], `${endpoint} a répondu ${status}`).toContain(status);
    }
  });
});

// ---------------------------------------------------------------------------
// Élève
// ---------------------------------------------------------------------------

test.describe.serial("Cloisonnement — élève", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await signedInPage(browser, "student");
  });
  test.afterAll(async () => {
    await page?.close();
  });

  test("aucun écran formateur ne s'ouvre", async () => {
    for (const path of INSTRUCTOR_PAGES) {
      await page.goto(path);
      expect(pathOf(page), `${path} ne doit pas s'ouvrir à un élève`).not.toBe(path);
    }
  });

  test("aucun écran d'administration ne s'ouvre", async () => {
    for (const path of ADMIN_PAGES) {
      await page.goto(path);
      expect(pathOf(page), `${path} ne doit pas s'ouvrir à un élève`).not.toBe(path);
    }
  });

  test("les API d'administration refusent l'élève côté serveur", async () => {
    for (const endpoint of ADMIN_APIS) {
      const status = await fetchStatus(page, endpoint);
      expect([401, 403], `${endpoint} a répondu ${status}`).toContain(status);
    }
  });

  test("ses propres espaces restent accessibles", async () => {
    for (const path of STUDENT_PAGES) {
      await page.goto(path);
      expect(pathOf(page), `${path} devrait s'ouvrir`).toBe(path);
    }
  });

  // Placé en dernier du bloc : il vide les cookies et détruit donc la session
  // partagée. Il réutilise cette session plutôt que d'en ouvrir une seconde,
  // pour ne pas consommer deux fois le budget de connexions du compte.
  test("la session ne survit pas à la suppression des cookies", async () => {
    await page.goto("/profil");
    expect(pathOf(page)).toBe("/profil");
    await page.context().clearCookies();
    await page.goto("/profil");
    expect(pathOf(page)).toBe("/connexion");
  });
});

// ---------------------------------------------------------------------------
// Formateur
// ---------------------------------------------------------------------------

test.describe.serial("Cloisonnement — formateur", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await signedInPage(browser, "instructor");
  });
  test.afterAll(async () => {
    await page?.close();
  });

  test("son espace s'ouvre entièrement", async () => {
    for (const path of INSTRUCTOR_PAGES) {
      await page.goto(path);
      expect(pathOf(page), `${path} devrait s'ouvrir pour un formateur`).toBe(path);
    }
  });

  test("aucun écran d'administration ne s'ouvre", async () => {
    for (const path of ADMIN_PAGES) {
      await page.goto(path);
      expect(pathOf(page), `${path} ne doit pas s'ouvrir à un formateur`).not.toBe(path);
    }
  });

  test("les API d'administration le refusent côté serveur", async () => {
    for (const endpoint of ADMIN_APIS) {
      const status = await fetchStatus(page, endpoint);
      expect([401, 403], `${endpoint} a répondu ${status}`).toContain(status);
    }
  });
});

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

test.describe.serial("Cloisonnement — administration", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await signedInPage(browser, "admin");
  });
  test.afterAll(async () => {
    await page?.close();
  });

  test("tous les écrans d'administration s'ouvrent", async () => {
    for (const path of ADMIN_PAGES) {
      await page.goto(path, { waitUntil: "networkidle" });
      const landed = pathOf(page);
      // Plusieurs entrées redirigent volontairement : une rubrique sans écran
      // propre part sur son premier onglet (`/admin/support` →
      // `/admin/support/tickets`), et d'anciennes URL sont conservées vers leur
      // remplaçante (`/admin/securite/roles` → `/admin/equipe`). L'invariant
      // n'est donc pas l'URL d'arrivée mais le fait de ne PAS être éjecté :
      // un refus renverrait vers `/` ou `/connexion`.
      expect(
        landed.startsWith("/admin"),
        `${path} a éjecté l'administration vers ${landed}`,
      ).toBe(true);
    }
  });

  test("l'espace formateur reste atteignable", async () => {
    await page.goto("/formateur");
    expect(pathOf(page)).toBe("/formateur");
  });

  test("les API d'administration répondent", async () => {
    for (const endpoint of ADMIN_APIS) {
      expect(await fetchStatus(page, endpoint), endpoint).toBe(200);
    }
  });

  test("aucun lien du menu ne mène à une page retirée", async () => {
    // On parcourt aussi les sections : les sous-menus ne sont rendus que sur
    // l'écran de leur rubrique, et c'est là que se cachent les liens morts.
    const dead = new Set<string>();
    for (const entry of ["/admin", ...ADMIN_PAGES]) {
      await page.goto(entry, { waitUntil: "networkidle" });
      const hrefs = await page
        .locator("a[href^='/admin']")
        .evaluateAll((nodes) =>
          nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href") ?? ""),
        );
      for (const href of hrefs) {
        if (REMOVED_PAGES.some((removed) => href === removed || href.startsWith(`${removed}/`))) {
          dead.add(`${href} (depuis ${entry})`);
        }
      }
    }
    expect([...dead], "liens morts dans la navigation admin").toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

test.describe.serial("Session — connexion et déconnexion", () => {
  test("un mot de passe faux ne connecte pas et ne nomme pas la cause", async ({ page }) => {
    await page.goto("/connexion");
    await page.fill("#email", QA_ACCOUNTS.student);
    await page.fill("#password", "MauvaisMotDePasse!123");
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
    expect(pathOf(page)).toBe("/connexion");
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toContain("mot de passe incorrect pour");
  });

  test("un compte inexistant ne révèle pas son absence", async ({ page }) => {
    await page.goto("/connexion");
    await page.fill("#email", "inconnu.total@audit.local");
    await page.fill("#password", QA_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
    expect(pathOf(page)).toBe("/connexion");
    const body = (await page.locator("body").innerText()).toLowerCase();
    expect(body).not.toMatch(/aucun compte|utilisateur introuvable|n'existe pas/);
  });

});
