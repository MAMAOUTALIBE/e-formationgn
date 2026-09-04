import { expect, test } from "@playwright/test";

test.describe("Partenaires — accueil", () => {
  test("remplace l'ancien bloc et affiche la liste officielle", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const section = page.getByRole("region", { name: "Nos partenaires" });
    await expect(section).toBeVisible();
    await expect(page.getByText("Comment ça marche ?", { exact: true })).toHaveCount(0);
    await expect(section.locator('[data-partner-copy="primary"] > li')).toHaveCount(40);
    await expect(section.getByAltText("ACTIS")).toBeVisible();
    await expect(section.getByAltText("ADEME")).toHaveCount(1);
  });

  test("défile en continu et répond aux flèches latérales", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const track = page.locator("[data-partner-track]");
    const section = page.getByRole("region", { name: "Nos partenaires" });
    const next = section.getByRole("button", {
      name: "Afficher les partenaires suivants",
    });
    const previous = section.getByRole("button", {
      name: "Afficher les partenaires précédents",
    });

    await expect(track).toHaveCSS("animation-play-state", "running");
    const viewportBox = await page.locator("[data-partner-viewport]").boundingBox();
    if (!viewportBox) throw new Error("Le carrousel partenaires n'est pas visible");
    await page.mouse.move(
      viewportBox.x + viewportBox.width / 2,
      viewportBox.y + viewportBox.height / 2,
    );
    await expect(track).toHaveCSS("animation-play-state", "running");
    await expect(previous).toBeVisible();
    await expect(next).toBeVisible();
    await expect(section.getByRole("button", { name: /pause/i })).toHaveCount(0);

    const before = await track.evaluate(
      (element) => Number(element.getAnimations()[0]?.currentTime ?? 0),
    );
    await next.click();
    const after = await track.evaluate(
      (element) => Number(element.getAnimations()[0]?.currentTime ?? 0),
    );

    expect(after - before).toBeGreaterThan(2_000);
    await previous.click();
    const afterPrevious = await track.evaluate(
      (element) => Number(element.getAnimations()[0]?.currentTime ?? 0),
    );
    expect(after - afterPrevious).toBeGreaterThan(2_000);
    await expect(track).toHaveCSS("animation-play-state", "running");
  });

  test("reste contenu dans l'écran mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.getByRole("region", { name: "Nos partenaires" })).toBeVisible();
    const sectionHeight = await page
      .getByRole("region", { name: "Nos partenaires" })
      .evaluate((element) => element.getBoundingClientRect().height);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sectionHeight).toBeLessThan(250);
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("désactive le mouvement quand l'utilisateur le demande", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.locator("[data-partner-track]")).toHaveCSS("animation-name", "none");
    await expect(page.locator('[data-partner-copy="duplicate"]')).toBeHidden();

    const viewport = page.locator("[data-partner-viewport]");
    const before = await viewport.evaluate((element) => element.scrollLeft);
    await page
      .getByRole("button", { name: "Afficher les partenaires suivants" })
      .click();
    const after = await viewport.evaluate((element) => element.scrollLeft);
    expect(after).toBeGreaterThan(before);
  });
});
