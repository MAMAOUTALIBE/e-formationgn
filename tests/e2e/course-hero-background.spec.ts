import { expect, test } from "@playwright/test";

import { loginOrSkip, QA_COURSES } from "./helpers/auth";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test.describe.serial("Image d’arrière-plan du hero d’une formation", () => {
  test("le CRM prévisualise, enregistre puis restaure le fond actuel", async ({ page }) => {
    test.setTimeout(180_000);
    await loginOrSkip(page, "admin");

    await page.goto(`/admin/cours?q=${encodeURIComponent(QA_COURSES.instructor)}`);
    const detailHref = await page
      .getByRole("link", { name: "QA — Formation du formateur un", exact: true })
      .getAttribute("href");
    expect(detailHref).toMatch(/^\/admin\/cours\//);
    await page.goto(detailHref!, { waitUntil: "domcontentloaded", timeout: 90_000 });

    const form = page.locator("form").filter({ hasText: "Image d’arrière-plan du hero" });
    await expect(form).toBeVisible();
    await expect(form.getByText("Conserver l’image actuelle")).toBeVisible();
    await expect(form.getByText("Restaurer l’image par défaut")).toBeVisible();

    await form.getByText("Restaurer l’image par défaut").click();
    await form.getByRole("button", { name: "Enregistrer" }).click();
    await expect(form.getByText(/image par défaut (restaurée|est déjà utilisée)/i)).toBeVisible();

    await form.locator('input[type="file"]').setInputFiles({
      name: "hero-test.png",
      mimeType: "image/png",
      buffer: PNG_1X1,
    });
    await expect(form.getByText("Nouvelle image — aperçu avant validation")).toBeVisible();
    const preview = form.getByAltText("Aperçu de l’image d’arrière-plan du hero");
    await expect(preview).toBeVisible();
    await expect(preview).toHaveClass(/object-cover/);
    await expect(preview).toHaveClass(/object-center/);

    await form.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Image d’arrière-plan enregistrée.")).toBeVisible();

    await page.goto(`/cours/${QA_COURSES.instructor}`);
    await expect(page.getByRole("heading", { name: "QA — Formation du formateur un" })).toBeVisible();
    const hero = page.locator("main > section").first();
    await expect(hero).toBeVisible();
    await expect(hero).toHaveClass(/bg-cover/);
    await expect(hero).toHaveClass(/bg-center/);
    await expect(hero.locator(".bg-black\\/55")).toHaveCount(1);
    expect(await hero.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("url(");
    expect(Math.round((await hero.boundingBox())?.width ?? 0)).toBe(
      await page.evaluate(() => window.innerWidth),
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "QA — Formation du formateur un" })).toBeVisible();
    const mobileHero = page.locator("main > section").first();
    await expect(mobileHero).toBeVisible();
    await expect(mobileHero).toHaveClass(/bg-cover/);
    expect(Math.round((await mobileHero.boundingBox())?.width ?? 0)).toBe(390);

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goBack();
    const restoredForm = page.locator("form").filter({ hasText: "Image d’arrière-plan du hero" });
    await restoredForm.getByText("Restaurer l’image par défaut").click();
    await restoredForm.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Image par défaut restaurée.")).toBeVisible();

    await page.goto(`/cours/${QA_COURSES.instructor}`);
    await expect(page.getByRole("heading", { name: "QA — Formation du formateur un" })).toBeVisible();
    const defaultHero = page.locator("main > section").first();
    await expect(defaultHero).not.toHaveClass(/bg-cover/);
    await expect(defaultHero.locator(".bg-black\\/55")).toHaveCount(0);
    expect(await defaultHero.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("linear-gradient");
  });

  test("la route d’import refuse un visiteur anonyme", async ({ browser }) => {
    const anonymous = await browser.newContext();
    const response = await anonymous.request.post("/api/upload/course-hero-background", {
      maxRedirects: 0,
      data: {
        courseId: "inexistant",
        filename: "hero.png",
        contentType: "image/png",
        sizeBytes: PNG_1X1.byteLength,
      },
    });
    expect([301, 302, 303, 307, 308, 401]).toContain(response.status());
    await anonymous.close();
  });
});
