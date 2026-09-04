import { expect, test, type Locator, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "mobile", width: 390, height: 844 },
  { name: "mobile compact", width: 360, height: 640 },
] as const;

async function openContact(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("efg_cookie_ok", "1");
  });
  await page.goto("/contact");
  await expect(page.getByTestId("contact-assistant")).toBeVisible();
}

async function expectInsideViewport(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  const [box, viewport] = await Promise.all([
    locator.boundingBox(),
    page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight })),
  ]);
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function expectDocumentLocked(page: Page) {
  const geometry = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight + 1);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
}

async function expectNotCovered(locator: Locator) {
  expect(
    await locator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const top = document.elementFromPoint(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
      );
      return top === element || (top instanceof Node && element.contains(top));
    }),
  ).toBe(true);
}

async function expectFeedFollowing(page: Page) {
  const feed = page.getByRole("log");
  await expect
    .poll(() =>
      feed.evaluate(
        (element) => element.scrollHeight - element.scrollTop - element.clientHeight,
      ),
    )
    .toBeLessThanOrEqual(1);
}

async function answer(page: Page, label: string, value: string) {
  await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Continuer" }).click();
}

for (const viewport of VIEWPORTS) {
  test(`la saisie active reste dans une vue sans scroll — ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openContact(page);

    await expectDocumentLocked(page);
    await expectInsideViewport(page, page.getByTestId("contact-assistant-input"));
    await expectInsideViewport(
      page,
      page.getByRole("button", { name: "Continuer" }),
    );
    await expect(page.locator("footer")).toHaveCount(0);
  });
}

test("le bandeau cookies ne recouvre pas le compositeur sur petit écran", async ({
  page,
}) => {
  await page.setViewportSize(VIEWPORTS[3]);
  await page.goto("/contact");

  await expect(
    page.getByRole("region", { name: "Information sur les cookies" }),
  ).toBeVisible();
  await expectDocumentLocked(page);
  await expectInsideViewport(page, page.getByTestId("contact-assistant-input"));
  const continueButton = page.getByRole("button", { name: "Continuer" });
  await expectInsideViewport(page, continueButton);
  await expectNotCovered(continueButton);
});

test("le récapitulatif et les deux choix de consentement restent atteignables", async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize(VIEWPORTS[0]);
  await openContact(page);

  await answer(page, "Quel est votre besoin de formation ?", "Former mon équipe aux usages de l'intelligence artificielle.");
  await expect(page.getByLabel("Merci. Quel est votre nom ?", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await answer(page, "Merci. Quel est votre nom ?", "Aminata Diallo");
  await answer(page, "Pour quelle entreprise faites-vous cette demande ?", "Exemple Conseil");
  await answer(page, "À quel numéro un conseiller peut-il vous joindre ?", "+33 6 12 34 56 78");
  await answer(page, "Quelle est votre adresse e-mail ?", "aminata@example.fr");
  await answer(page, "Quelle formation recherchez-vous précisément ?", "Intelligence artificielle pour le marketing");
  await answer(page, "Quand êtes-vous disponible pour être recontacté ?", "Mardi matin");

  const consent = page.getByTestId("contact-assistant-consent");
  const accept = page.getByRole("button", {
    name: /Oui, j.accepte et j.envoie/,
  });
  const decline = page.getByRole("button", { name: "Non, ne rien envoyer" });

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await expectDocumentLocked(page);
    await expectFeedFollowing(page);
    await expectInsideViewport(page, consent);
    await expectInsideViewport(page, accept);
    await expectInsideViewport(page, decline);
  }
});
