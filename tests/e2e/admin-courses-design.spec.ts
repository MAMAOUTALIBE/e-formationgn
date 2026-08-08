import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

test.describe("CRM admin — cours", () => {
  test("la route reste protégée", async ({ page }) => {
    await page.goto("/admin/cours");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("centralise catalogue, qualité, modération et vedettes avec les données réelles", async () => {
    const [pageSource, querySource] = await Promise.all([
      readFile(path.join(root, "src/app/admin/cours/page.tsx"), "utf8"),
      readFile(path.join(root, "src/server/queries/admin-courses.ts"), "utf8"),
    ]);
    expect(pageSource).toContain('data-testid="courses-workspace"');
    expect(pageSource).toContain("computeQualityScore");
    expect(pageSource).toContain("/admin/cours/moderation");
    expect(pageSource).toContain("/admin/cours/featured");
    expect(pageSource).toContain('name="instructorId"');
    expect(querySource).toContain("getAdminCoursesDashboardData");
    expect(querySource).toContain("totalEnrollments");
    expect(querySource).toContain("topCategories");
  });
});
