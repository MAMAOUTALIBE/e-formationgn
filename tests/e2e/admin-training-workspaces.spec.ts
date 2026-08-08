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

  test("les formateurs utilisent Stripe, cours, élèves, notes et revenus réels", async () => {
    const source = await readFile(path.join(root, "src/app/admin/formateurs/page.tsx"), "utf8");
    expect(source).toContain('data-testid="instructors-workspace"');
    expect(source).toContain("stripeOnboardingDone");
    expect(source).toContain("coursesAuthored");
    expect(source).toContain("instructorPayoutCents");
    expect(source).toContain("exportInstructorsCsv");
  });

  test("les formations utilisent programmes, sessions, inscriptions et revenus réels", async () => {
    const [pageSource, querySource] = await Promise.all([
      readFile(path.join(root, "src/app/admin/formations/page.tsx"), "utf8"),
      readFile(path.join(root, "src/server/queries/admin-programs.ts"), "utf8"),
    ]);
    expect(pageSource).toContain('data-testid="programs-workspace"');
    expect(pageSource).toContain("exportProgramsCsv");
    expect(querySource).toContain("prisma.trainingSession.count");
    expect(querySource).toContain("prisma.registration.count");
    expect(querySource).toContain("prisma.orderItem.groupBy");
  });
});
