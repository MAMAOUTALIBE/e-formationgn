import { expect, test } from "@playwright/test";

import { loginOrSkip } from "./helpers/auth";

test("les cartes de leçon restent blanches et lisibles dans les deux thèmes", async ({
  page,
}) => {
  test.setTimeout(60_000);

  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await loginOrSkip(page, "instructor");
  await page.goto("/formateur/cours", { waitUntil: "networkidle" });

  const courseHref = await page
    .locator("a[href^='/formateur/cours/']", {
      hasText: "QA — Formation du formateur un",
    })
    .first()
    .getAttribute("href");
  expect(courseHref).toBeTruthy();

  const courseId = courseHref?.split("/")[3];
  await page.goto(`/formateur/cours/${courseId}/programme`, {
    waitUntil: "domcontentloaded",
  });

  const card = page.locator("[data-lesson-card]").first();
  await expect(card).toBeVisible();

  for (const dark of [false, true]) {
    await page.evaluate((enabled) => {
      document.documentElement.classList.toggle("dark", enabled);
    }, dark);

    await expect(card).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(card.locator(".text-foreground").first()).toHaveCSS(
      "color",
      "rgb(15, 23, 42)",
    );
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(card).toBeVisible();
  await expect(card).toHaveCSS("background-color", "rgb(255, 255, 255)");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(consoleErrors).toEqual([]);
});
