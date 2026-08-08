import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

test.describe("Espace apprenants CRM", () => {
  test("reste protégé pour un visiteur anonyme", async ({ page }) => {
    await page.goto("/admin/utilisateurs");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("branche les indicateurs, filtres et actions sur les données réelles", async () => {
    const [pageSource, querySource] = await Promise.all([
      readFile(path.join(root, "src/app/admin/utilisateurs/page.tsx"), "utf8"),
      readFile(path.join(root, "src/server/queries/admin-users.ts"), "utf8"),
    ]);

    expect(pageSource).toContain("getAdminUsersDashboardStats()");
    expect(pageSource).toContain("listAdminUsers(filters)");
    expect(pageSource).toContain("listSelectableCompanies()");
    expect(pageSource).toContain("listUserCountries()");
    expect(pageSource).toContain("CreateAccountForm companies={companies}");
    expect(pageSource).toContain("ImportStudentsForm courses={publishedCourses}");
    expect(pageSource).toContain("action={exportUsersCsv}");
    expect(pageSource).toContain('data-testid="learners-workspace"');
    expect(querySource).toContain("prisma.user.count");
    expect(querySource).toContain('role: { in: ["STUDENT", "INSTRUCTOR"] }');
  });
});
