import { expect, test } from "@playwright/test";

test.describe("Header public", () => {
  test("affiche les menus en cartes, la recherche capsule et l'état actif", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/cours");

    const header = page.locator("header").first();
    const navigation = header.getByRole("navigation", {
      name: "Navigation principale",
    });
    const search = header.getByRole("search");

    await expect(header.getByRole("link", { name: "Accueil Aiduca" })).toBeVisible();
    await expect(navigation.getByRole("button", { name: "Catégories" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Catalogue" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(search).toHaveClass(/rounded-full/);
    await expect(search.getByRole("combobox", { name: "Rechercher une formation" })).toBeVisible();
    await expect(search.getByRole("button", { name: "Lancer la recherche" })).toBeVisible();

    await search
      .getByRole("combobox", { name: "Rechercher une formation" })
      .fill("fondamentaux");
    await search.getByRole("button", { name: "Lancer la recherche" }).click();
    await expect(page).toHaveURL(/\/cours\?q=fondamentaux/);

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(1440);
  });

  test("reste compact sur une ligne et bascule vers le menu mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    const header = page.locator("header").first();
    expect((await header.boundingBox())?.height).toBeLessThanOrEqual(70);
    expect(await header.evaluate((element) => element.scrollWidth)).toBe(
      await header.evaluate((element) => element.clientWidth),
    );
    await expect(header.getByRole("search")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(header.getByRole("search")).toBeHidden();
    await expect(header.getByRole("button", { name: "Ouvrir le menu" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  });
});
