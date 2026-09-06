import { expect, test } from "@playwright/test";

import { loginOrSkip } from "./helpers/auth";

test.describe("Présentation privée — garde HTTP", () => {
  test("un visiteur anonyme ne reçoit jamais une image, en GET comme en HEAD", async ({
    request,
  }) => {
    const path = "/api/lecons/lecon-inexistante/presentation/diapositives/slide-inexistante";
    const [get, head] = await Promise.all([request.get(path), request.head(path)]);
    expect(get.status()).toBe(401);
    expect(head.status()).toBe(401);
    expect(get.headers()["content-disposition"]).toBeUndefined();
  });
});

test.describe("Lecteur de présentation — recette authentifiée", () => {
  test.use({ hasTouch: true });

  test.skip(
    !process.env.QA_PRESENTATION_URL,
    "Définir QA_PRESENTATION_URL vers une leçon PRESENTATION READY inscrite.",
  );

  test.beforeEach(async ({ page }) => {
    await loginOrSkip(page, "student");
  });

  test("navigation clavier, mobile et accessibilité", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(process.env.QA_PRESENTATION_URL!);
    const player = page.locator("[data-presentation-player]");
    await expect(player).toBeVisible();
    await expect(player.getByRole("progressbar", { name: "Diapositives consultées" })).toBeVisible();
    await expect(player.locator("img")).toHaveAttribute("draggable", "false");

    const counter = player.getByText(/\d+ \/ \d+/).first();
    const before = await counter.textContent();
    await expect(player).not.toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(counter).toHaveText(before ?? "");

    await player.focus();
    await expect(player).toBeFocused();
    await page.keyboard.press("Home");
    const fromFirstSlide = await counter.textContent();
    await page.keyboard.press("ArrowRight");
    await expect(counter).not.toHaveText(fromFirstSlide ?? "");

    const box = await player.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    }
    await expect(player.getByRole("button", { name: "Diapositive précédente" })).toBeEnabled();
  });

  test("le HTML ne divulgue aucune clé et une leçon substituée ne sert pas la slide", async ({
    page,
  }) => {
    await page.goto(process.env.QA_PRESENTATION_URL!);
    const html = await page.content();
    expect(html).not.toContain("sourceKey");
    expect(html).not.toContain("imageKey");
    expect(html).not.toContain("presentations/rendered/");

    const src = await page.locator("[data-presentation-player] img").getAttribute("src");
    expect(src).toBeTruthy();
    const wrongLessonUrl = src!.replace(/\/api\/lecons\/[^/]+\//, "/api/lecons/autre-lecon/");
    const status = await page.evaluate((url) => fetch(url).then((response) => response.status), wrongLessonUrl);
    expect(status).toBe(404);
  });
});
