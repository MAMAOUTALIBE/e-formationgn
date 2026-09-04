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

  test("le défilement peut être mis en pause puis repris", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const track = page.locator("[data-partner-track]");
    const control = page
      .getByRole("region", { name: "Nos partenaires" })
      .locator('button[aria-pressed]');

    await expect(track).toHaveCSS("animation-play-state", "running");
    await control.click();
    await expect(track).toHaveCSS("animation-play-state", "paused");
    await expect(control).toHaveAttribute("aria-pressed", "true");

    await control.click();
    await expect(track).toHaveCSS("animation-play-state", "running");
  });

  test("reste contenu dans l'écran mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.getByRole("region", { name: "Nos partenaires" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });

  test("désactive le mouvement quand l'utilisateur le demande", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "networkidle" });

    await expect(page.locator("[data-partner-track]")).toHaveCSS("animation-name", "none");
    await expect(page.locator('[data-partner-copy="duplicate"]')).toBeHidden();
    await expect(
      page.getByRole("button", {
        name: /défilement des partenaires/,
        includeHidden: true,
      }),
    ).toBeHidden();
  });
});
