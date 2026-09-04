import { expect, test } from "@playwright/test";

test.describe("Footer public simplifié", () => {
  test("affiche les trois zones demandées et le bandeau légal sur ordinateur", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/credits");

    const footer = page.getByRole("contentinfo");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();

    const presentation = footer.getByRole("region", { name: "Présentation d'Aiduca" });
    const essentials = footer.getByRole("navigation", { name: "Liens essentiels" });
    const contact = footer.getByRole("region", { name: "Nous contacter" });
    const legal = footer.getByRole("navigation", { name: "Informations légales" });

    await expect(essentials.getByRole("link")).toHaveText([
      "Catalogue",
      "À propos",
      "Contact",
      "Se connecter",
    ]);
    await expect(legal.getByRole("link")).toHaveText([
      "Mentions légales",
      "CGV",
      "Confidentialité",
    ]);
    await expect(footer.getByText(/Newsletter mensuelle/i)).toBeVisible();
    await expect(presentation.getByRole("img", { name: "AIDUCA" })).toHaveAttribute(
      "src",
      "/images/aiduca-logo-transparent.png",
    );
    await expect(footer.getByRole("textbox", { name: "Adresse email" })).toBeVisible();
    await expect(footer.getByRole("checkbox")).toBeVisible();
    await expect(footer.getByRole("button", { name: "S'inscrire" })).toBeVisible();
    const newsletterCapsule = footer.getByRole("group", {
      name: "Inscription à la newsletter",
    });
    await expect(newsletterCapsule).toHaveClass(/rounded-full/);
    const [emailBox, subscribeBox] = await Promise.all([
      newsletterCapsule.getByRole("textbox", { name: "Adresse email" }).boundingBox(),
      newsletterCapsule.getByRole("button", { name: "S'inscrire" }).boundingBox(),
    ]);
    expect(emailBox).not.toBeNull();
    expect(subscribeBox).not.toBeNull();
    expect(Math.abs(emailBox!.y - subscribeBox!.y)).toBeLessThanOrEqual(2);
    expect(emailBox!.x + emailBox!.width).toBeLessThanOrEqual(subscribeBox!.x + 1);
    await expect(contact.getByText("info@aiduca.fr")).toBeVisible();
    await expect(contact.getByAltText(/Certification Qualiopi/)).toBeVisible();
    const backgroundSlides = footer.locator("[data-footer-slide]");
    await expect(backgroundSlides).toHaveCount(5);
    await expect(backgroundSlides.first()).toHaveAttribute("alt", "");
    await expect(backgroundSlides.first()).toHaveCSS("animation-duration", "150s");

    const [presentationBox, essentialsBox, contactBox] = await Promise.all([
      presentation.boundingBox(),
      essentials.boundingBox(),
      contact.boundingBox(),
    ]);
    expect(presentationBox).not.toBeNull();
    expect(essentialsBox).not.toBeNull();
    expect(contactBox).not.toBeNull();
    expect(presentationBox!.x).toBeLessThan(essentialsBox!.x);
    expect(essentialsBox!.x).toBeLessThan(contactBox!.x);
  });

  test("empile le contenu sans débordement sur mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/credits");

    const footer = page.getByRole("contentinfo");
    await footer.scrollIntoViewIfNeeded();

    const presentation = footer.getByRole("region", { name: "Présentation d'Aiduca" });
    const essentials = footer.getByRole("navigation", { name: "Liens essentiels" });
    const contact = footer.getByRole("region", { name: "Nous contacter" });
    const [presentationBox, essentialsBox, contactBox] = await Promise.all([
      presentation.boundingBox(),
      essentials.boundingBox(),
      contact.boundingBox(),
    ]);

    expect(presentationBox).not.toBeNull();
    expect(essentialsBox).not.toBeNull();
    expect(contactBox).not.toBeNull();
    expect(presentationBox!.y).toBeLessThan(essentialsBox!.y);
    expect(essentialsBox!.y).toBeLessThan(contactBox!.y);
    const newsletterCapsule = footer.getByRole("group", {
      name: "Inscription à la newsletter",
    });
    const [emailBox, subscribeBox, consentBox] = await Promise.all([
      newsletterCapsule.getByRole("textbox", { name: "Adresse email" }).boundingBox(),
      newsletterCapsule.getByRole("button", { name: "S'inscrire" }).boundingBox(),
      footer.getByRole("checkbox").boundingBox(),
    ]);
    expect(emailBox).not.toBeNull();
    expect(subscribeBox).not.toBeNull();
    expect(consentBox).not.toBeNull();
    expect(Math.abs(emailBox!.y - subscribeBox!.y)).toBeLessThanOrEqual(2);
    expect(consentBox!.y).toBeGreaterThan(subscribeBox!.y + subscribeBox!.height);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  });
});
