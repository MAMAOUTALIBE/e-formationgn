// Accessibilité de base, adaptation aux écrans, et propreté de la console.
//
// Ces contrôles sont structurels : ils ne remplacent pas un audit RGAA, mais
// ils attrapent les régressions qui rendent une page inutilisable au clavier,
// illisible sur mobile, ou bruyante en production.

import { expect, test, type Page } from "@playwright/test";

/** Pages publiques les plus fréquentées. */
const PUBLIC_PAGES = ["/", "/cours", "/categories", "/connexion", "/aide", "/contact"];

/** Formats couverts : mobile, tablette, ordinateur. */
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablette", width: 820, height: 1180 },
  { name: "ordinateur", width: 1440, height: 900 },
];

test.describe("Accessibilité — structure des pages publiques", () => {
  for (const target of PUBLIC_PAGES) {
    test(`${target} expose une structure exploitable`, async ({ page }) => {
      await page.goto(target, { waitUntil: "networkidle" });

      // La langue doit être déclarée : sans elle, les lecteurs d'écran lisent
      // le français avec une prononciation anglaise.
      const lang = await page.locator("html").getAttribute("lang");
      expect(lang, `${target} : attribut lang manquant`).toBeTruthy();
      expect(lang!.toLowerCase()).toContain("fr");

      // Un seul titre de premier niveau, et il doit exister.
      const headings = await page.locator("h1").count();
      expect(headings, `${target} : ${headings} balise(s) h1`).toBe(1);

      // Toute image porte un texte de remplacement (vide toléré si décorative).
      const imagesSansAlt = await page.locator("img:not([alt])").count();
      expect(imagesSansAlt, `${target} : ${imagesSansAlt} image(s) sans attribut alt`).toBe(0);

      // Un repère de navigation principal.
      expect(await page.locator("main, [role='main']").count()).toBeGreaterThan(0);
    });
  }

  test("chaque champ du formulaire de connexion est étiqueté", async ({ page }) => {
    await page.goto("/connexion", { waitUntil: "networkidle" });
    const champs = page.locator("input:not([type='hidden'])");
    const total = await champs.count();
    expect(total).toBeGreaterThan(0);
    for (let index = 0; index < total; index += 1) {
      const champ = champs.nth(index);
      const id = await champ.getAttribute("id");
      const aria = await champ.getAttribute("aria-label");
      const ariaBy = await champ.getAttribute("aria-labelledby");
      const etiquette = id ? await page.locator(`label[for="${id}"]`).count() : 0;
      expect(
        etiquette > 0 || Boolean(aria) || Boolean(ariaBy),
        `champ #${id ?? index} sans étiquette`,
      ).toBe(true);
    }
  });

  test("la connexion est utilisable au clavier seul", async ({ page }) => {
    await page.goto("/connexion", { waitUntil: "networkidle" });
    await page.locator("#email").focus();
    await page.keyboard.type("qa.eleve@audit.local");
    await page.keyboard.press("Tab");
    await page.keyboard.type("mot-de-passe-quelconque");
    // Le focus doit avoir atteint le champ mot de passe, pas un piège.
    const actif = await page.evaluate(() => document.activeElement?.id ?? "");
    expect(actif).toBe("password");
  });
});

test.describe("Adaptation aux écrans", () => {
  for (const viewport of VIEWPORTS) {
    test(`aucun débordement horizontal en ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const target of ["/", "/cours", "/connexion"]) {
        await page.goto(target, { waitUntil: "networkidle" });
        const debordement = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        // Quelques pixels de tolérance : une ombre ou une bordure peut dépasser.
        expect(
          debordement,
          `${target} déborde de ${debordement}px en ${viewport.width}px de large`,
        ).toBeLessThanOrEqual(2);
      }
    });
  }

  test("la navigation reste atteignable sur mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });
    // Soit un menu déroulant, soit des liens visibles : l'un des deux au moins.
    const liensVisibles = await page.locator("header a:visible").count();
    const boutonsMenu = await page.locator("header button:visible").count();
    expect(liensVisibles + boutonsMenu).toBeGreaterThan(0);
  });
});

test.describe("Console du navigateur", () => {
  /** Bruits connus, hors du contrôle applicatif. */
  const IGNORÉS = [
    /favicon/i,
    /Failed to load resource: the server responded with a status of 404/i,
    /Download the React DevTools/i,
    /\[Fast Refresh\]/i,
  ];

  async function erreursDe(page: Page, target: string): Promise<string[]> {
    const erreurs: string[] = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const texte = message.text();
      if (IGNORÉS.some((motif) => motif.test(texte))) return;
      erreurs.push(texte);
    });
    page.on("pageerror", (error) => erreurs.push(`pageerror: ${error.message}`));
    await page.goto(target, { waitUntil: "networkidle" });
    return erreurs;
  }

  for (const target of PUBLIC_PAGES) {
    test(`${target} ne produit aucune erreur de console`, async ({ page }) => {
      const erreurs = await erreursDe(page, target);
      expect(erreurs, `${target} : ${erreurs.join(" | ")}`).toEqual([]);
    });
  }
});
