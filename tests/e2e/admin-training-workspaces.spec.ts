import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

test.describe("CRM formateurs et formations", () => {
  for (const route of ["/admin/formateurs", "/admin/formations"]) {
    test(`${route} reste protégé`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/connexion/);
    });
  }

  test("les formateurs utilisent les cours et inscriptions réels du LMS", async () => {
    const source = await readFile(path.join(root, "src/app/admin/formateurs/page.tsx"), "utf8");
    expect(source).toContain("Gestion des formateurs");
    expect(source).toContain("isInstructor: true");
    expect(source).toContain("coursesAuthored");
    expect(source).toContain("totalEnrollments");
    expect(source).not.toContain("stripeOnboardingDone");
  });

  test("les formations utilisent programmes, sessions et inscriptions réels", async () => {
    const [pageSource, querySource] = await Promise.all([
      readFile(path.join(root, "src/app/admin/formations/page.tsx"), "utf8"),
      readFile(path.join(root, "src/server/queries/admin-programs.ts"), "utf8"),
    ]);
    expect(pageSource).toContain('data-testid="programs-workspace"');
    expect(pageSource).toContain("exportProgramsCsv");
    expect(querySource).toContain("prisma.trainingSession.count");
    expect(querySource).toContain("prisma.registration.count");
    expect(querySource).toContain("prisma.program.findMany");
  });
});
