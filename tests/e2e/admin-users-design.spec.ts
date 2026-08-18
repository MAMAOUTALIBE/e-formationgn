import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

test.describe("Espace apprenants CRM", () => {
  test("les dates du tableau ont un fuseau déterministe pour l’hydratation", async () => {
    const source = await readFile(
      `${root}/src/components/features/admin/learners-table.tsx`,
      "utf8",
    );
    expect(source).toContain('timeZone: "UTC"');
  });
  test("reste protégé pour un visiteur anonyme", async ({ page }) => {
    await page.goto("/admin/utilisateurs");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("branche les indicateurs, filtres et actions sur les données réelles", async () => {
    const [pageSource, querySource, headerActionsSource] = await Promise.all([
      readFile(path.join(root, "src/app/admin/utilisateurs/page.tsx"), "utf8"),
      readFile(path.join(root, "src/server/queries/admin-users.ts"), "utf8"),
      readFile(path.join(root, "src/components/features/admin/learner-header-actions.tsx"), "utf8"),
    ]);

    expect(pageSource).toContain("getAdminUsersDashboardStats()");
    expect(pageSource).toContain("listAdminUsers(filters)");
    expect(pageSource).toContain("listSelectableCompanies()");
    expect(pageSource).toContain("listUserCountries()");
    expect(headerActionsSource).toContain("CreateAccountForm companies={companies}");
    expect(headerActionsSource).toContain("ImportStudentsForm courses={courses}");
    expect(headerActionsSource).toContain("action={exportUsersCsv}");
    expect(pageSource).toContain('data-testid="learners-workspace"');
    expect(querySource).toContain("prisma.user.count");
    expect(querySource).toContain('const where: Prisma.UserWhereInput = { role: "STUDENT" }');
    expect(querySource).not.toContain('role: { in: ["STUDENT", "INSTRUCTOR"] }');
    expect(pageSource).not.toContain('name="role"');
  });
});
