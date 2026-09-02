import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

test.describe("CRM admin — cours", () => {
  test("les dates du tableau ont un fuseau déterministe pour l’hydratation", async () => {
    const source = await readFile(
      `${root}/src/components/features/admin/courses-table.tsx`,
      "utf8",
    );
    expect(source).toContain('timeZone: "UTC"');
  });
  test("la route reste protégée", async ({ page }) => {
    await page.goto("/admin/cours");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("centralise catalogue, qualité, modération et vedettes avec les données réelles", async () => {
    const [pageSource, querySource, navigationSource, tableSource] = await Promise.all([
      readFile(path.join(root, "src/app/admin/cours/page.tsx"), "utf8"),
      readFile(path.join(root, "src/server/queries/admin-courses.ts"), "utf8"),
      readFile(path.join(root, "src/lib/workspace/admin-nav.ts"), "utf8"),
      readFile(path.join(root, "src/components/features/admin/courses-table.tsx"), "utf8"),
    ]);
    expect(pageSource).toContain('data-testid="courses-workspace"');
    expect(pageSource).toContain("getAdminCoursesDashboardData");
    expect(pageSource).toContain("AdminCoursesTable");
    expect(pageSource).toContain("CourseFilters");
    expect(pageSource).toContain('name="instructorId"');
    expect(navigationSource).toContain("/admin/cours/moderation");
    expect(navigationSource).toContain("/admin/cours/featured");
    expect(querySource).toContain("getAdminCoursesDashboardData");
    expect(querySource).toContain("totalEnrollments");
    expect(querySource).toContain("instructors");
    expect(tableSource).toContain('data-testid="course-actions-menu"');
    // Le menu d'actions a perdu son dégradé le 26/08 : posé sur un calque
    // flottant, il rendait les libellés illisibles. On vérifie désormais ce qui
    // a remplacé ce dégradé — un fond opaque — et non sa présence, sinon cette
    // ligne redemanderait le défaut qu'elle avait servi à constater.
    expect(tableSource).not.toContain("from-brand-primary to-blue-950");
    expect(tableSource).toContain("AdminActionMenu");
  });
});
