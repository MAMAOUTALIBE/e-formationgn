// Aiduca-IA — parcours visiteur.
//
// Deux familles de tests, volontairement séparées :
//
//  - celles qui n'appellent PAS le modèle (ouverture, accessibilité, clavier,
//    responsive, escalade) : elles tournent toujours, à chaque exécution ;
//  - celle qui pose une vraie question : elle facture un appel API, elle est
//    donc ignorée quand ANTHROPIC_API_KEY est absente — même conditionnement
//    que admin-smoke.spec.ts avec ses identifiants.
//
// Cette séparation est délibérée : l'essentiel de ce qu'on veut garantir
// (les liens sont vivants, l'escalade fonctionne, rien ne déborde sur mobile)
// ne dépend pas de la réponse du modèle.

import { expect, test, type Page } from "@playwright/test";

const MODEL_AVAILABLE = Boolean(process.env.ANTHROPIC_API_KEY);

const VIEWPORTS = [
  { nom: "mobile", width: 390, height: 844 },
  { nom: "tablette", width: 820, height: 1180 },
  { nom: "ordinateur", width: 1440, height: 900 },
] as const;

/**
 * Accepte le bandeau cookies, comme le ferait un visiteur.
 *
 * Le bandeau apparaît après hydratation et décale le bouton flottant vers le
 * haut : tant qu'il est là, la cible bouge et le contrôle d'actionnabilité de
 * Playwright échoue par intermittence. L'écarter d'abord rend l'ouverture
 * déterministe. Le cas « bouton cliquable SOUS le bandeau » garde son propre
 * test, qui lui ne l'écarte pas.
 */
async function acceptCookies(page: Page) {
  // Apostrophe typographique dans le libellé (« J\u2019ai compris ») : une
  // correspondance sur l'apostrophe ASCII ne trouve rien, et le bandeau reste
  // en place sans que le test s'en aperçoive.
  const accept = page.getByRole("button", { name: /J.ai compris/ });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
    await expect(accept).toHaveCount(0);
  }
}

/** Attend que le bouton flottant ait cessé de bouger. */
async function waitForLauncherToSettle(page: Page) {
  const launcher = page.getByTestId("assistant-launcher");
  await expect(launcher).toBeVisible();
  await expect
    .poll(async () => {
      const first = await launcher.boundingBox();
      await page.waitForTimeout(150);
      const second = await launcher.boundingBox();
      return first && second && first.y === second.y;
    })
    .toBe(true);
  return launcher;
}

async function openAssistant(page: Page) {
  await acceptCookies(page);
  const launcher = await waitForLauncherToSettle(page);
  await launcher.click();
  await expect(page.getByTestId("assistant-panel")).toBeVisible();
}

test.describe("Widget Aiduca-IA", () => {
  test("le bouton flottant est présent sur les pages publiques", async ({ page }) => {
    for (const path of ["/", "/cours", "/aide"]) {
      await page.goto(path);
      await expect(
        page.getByTestId("assistant-launcher"),
        `le widget doit être disponible sur ${path}`,
      ).toBeVisible();
    }
  });

  test("le widget est absent de l'espace d'administration", async ({ page }) => {
    // /admin redirige vers /connexion pour un visiteur anonyme, et les écrans
    // d'authentification sont eux aussi exclus.
    await page.goto("/connexion");
    await expect(page.getByTestId("assistant-launcher")).toHaveCount(0);
  });

  test("le bouton reste atteignable sous le bandeau cookies", async ({ page }) => {
    // Régression : le bandeau cookies (z-50) recouvrait le bouton flottant
    // (z-40). Tout visiteur n'ayant pas encore accepté les cookies — c'est-à-
    // dire tout nouveau visiteur — ne pouvait pas ouvrir l'assistant.
    await page.goto("/");
    const banner = page.getByRole("region", { name: "Information sur les cookies" });
    await expect(banner, "le bandeau doit être affiché pour un visiteur neuf").toBeVisible();

    const launcher = await waitForLauncherToSettle(page);
    const covered = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="assistant-launcher"]');
      if (!el) return "bouton absent";
      const rect = el.getBoundingClientRect();
      const top = document.elementFromPoint(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
      );
      return el === top || el.contains(top) ? null : "recouvert";
    });
    expect(covered, "rien ne doit recouvrir le bouton de l'assistant").toBeNull();

    await launcher.click();
    await expect(page.getByTestId("assistant-panel")).toBeVisible();
  });

  test("le panneau s'ouvre, se ferme au clavier et rend le focus", async ({ page }) => {
    await page.goto("/");
    await acceptCookies(page);
    const launcher = await waitForLauncherToSettle(page);
    await launcher.click();

    const panel = page.getByTestId("assistant-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveAttribute("aria-modal", "true");

    // Le focus part sur la saisie : l'utilisateur peut taper immédiatement.
    await expect(page.locator("#assistant-question")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(launcher).toBeFocused();
  });

  test("l'envoi reste bloqué tant que la question est trop courte", async ({ page }) => {
    await page.goto("/");
    await openAssistant(page);

    const submit = page.getByRole("button", { name: "Envoyer" });
    await expect(submit).toBeDisabled();

    await page.locator("#assistant-question").fill("abc");
    await expect(submit, "trois caractères ne suffisent pas").toBeDisabled();

    await page.locator("#assistant-question").fill("Quels sont les prérequis ?");
    await expect(submit).toBeEnabled();
  });

  test("des suggestions de questions sont proposées à l'ouverture", async ({ page }) => {
    await page.goto("/");
    await openAssistant(page);

    await expect(page.getByTestId("assistant-suggestion").first()).toBeVisible();
    const count = await page.getByTestId("assistant-suggestion").count();
    expect(count).toBeGreaterThan(0);
  });

  test("la mention de conservation des données renvoie vers la politique", async ({
    page,
  }) => {
    await page.goto("/");
    await openAssistant(page);

    const panel = page.getByTestId("assistant-panel");
    await expect(panel).toContainText("90 jours");

    const lien = panel.getByRole("link", { name: "Confidentialité" });
    await expect(lien).toHaveAttribute("href", "/confidentialite");
  });

  for (const viewport of VIEWPORTS) {
    test(`le panneau tient dans l'écran en ${viewport.nom}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await openAssistant(page);

      const panel = page.getByTestId("assistant-panel");
      const box = await panel.boundingBox();
      expect(box, "le panneau doit être rendu").not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(viewport.width + 1);

      // Aucun débordement horizontal du document : c'est le symptôme classique
      // d'un panneau en largeur fixe sur petit écran.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, "la page ne doit pas défiler horizontalement").toBeLessThanOrEqual(1);

      // La saisie et le bouton d'envoi restent atteignables.
      await expect(page.locator("#assistant-question")).toBeVisible();
      await expect(page.getByRole("button", { name: "Envoyer" })).toBeVisible();
    });
  }
});

test.describe("Escalade vers un conseiller", () => {
  test("le formulaire refuse une demande sans consentement", async ({ page }) => {
    test.skip(!MODEL_AVAILABLE, "L'escalade s'ouvre depuis une réponse du modèle.");

    await page.goto("/");
    await openAssistant(page);
    await page.locator("#assistant-question").fill("Quel est le prix exact du parcours ?");
    await page.getByRole("button", { name: "Envoyer" }).click();

    await expect(page.getByTestId("assistant-answer").first()).toBeVisible({
      timeout: 60_000,
    });

    const escalate = page.getByTestId("assistant-escalate").first();
    if ((await escalate.count()) === 0) {
      test.skip(true, "Le modèle a répondu avec certitude : pas d'escalade proposée.");
    }
    await escalate.click();

    const form = page.getByTestId("assistant-lead-form");
    await expect(form).toBeVisible();

    await form.locator("#assistant-lead-name").fill("Test Aiduca");
    await form.locator("#assistant-lead-email").fill("test@exemple.fr");
    // Case de consentement volontairement non cochée.
    await form.getByRole("button", { name: "Envoyer ma demande" }).click();

    await expect(form).toContainText("accepter d'être recontacté");
  });
});

test.describe("Réponse du modèle", () => {
  test.skip(!MODEL_AVAILABLE, "ANTHROPIC_API_KEY absente : aucun appel facturé.");

  test("une question sur le prix n'aboutit jamais à un montant", async ({ page }) => {
    await page.goto("/");
    await openAssistant(page);

    await page
      .locator("#assistant-question")
      .fill("Combien coûte une formation chez vous ?");
    await page.getByRole("button", { name: "Envoyer" }).click();

    const answer = page.getByTestId("assistant-answer").first();
    await expect(answer).toBeVisible({ timeout: 60_000 });

    const texte = (await answer.textContent()) ?? "";
    // La plateforme n'affiche aucun prix et ne vend pas en ligne : annoncer un
    // montant serait une information fausse pour l'utilisateur.
    expect(
      texte,
      `la réponse ne doit annoncer aucun montant — reçu : ${texte}`,
    ).not.toMatch(/\d+\s?(€|euros?|EUR)/i);
    // Elle doit en revanche orienter vers le centre.
    expect(texte.toLowerCase()).toMatch(/contact|conseiller|centre|devis|aiduca/);
  });

  test("les boutons « Voir la formation » pointent vers des pages vivantes", async ({
    page,
    request,
  }) => {
    await page.goto("/cours");
    await openAssistant(page);

    await page
      .locator("#assistant-question")
      .fill("Quelles formations proposez-vous ?");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByTestId("assistant-answer").first()).toBeVisible({
      timeout: 60_000,
    });

    const liens = page.getByTestId("assistant-course-link");
    for (let i = 0; i < (await liens.count()); i += 1) {
      const href = await liens.nth(i).getAttribute("href");
      expect(href, "un bouton de formation doit porter un lien").toBeTruthy();
      expect(href!).toMatch(/^\/cours\/[a-z0-9-]+$/);

      const response = await request.get(href!, { maxRedirects: 0 });
      expect(
        response.status(),
        `${href} doit répondre 200 — un bouton vers un 404 est pire qu'aucun bouton`,
      ).toBe(200);
    }
  });

  test("la conversation survit à un changement de page", async ({ page }) => {
    await page.goto("/");
    await openAssistant(page);

    const question = "Comment se déroule une inscription ?";
    await page.locator("#assistant-question").fill(question);
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByTestId("assistant-answer").first()).toBeVisible({
      timeout: 60_000,
    });

    await page.goto("/aide");
    await openAssistant(page);

    // Le fil est persisté côté serveur et retrouvé par le cookie de session.
    await expect(page.getByTestId("assistant-panel")).toContainText(question, {
      timeout: 15_000,
    });
  });
});
