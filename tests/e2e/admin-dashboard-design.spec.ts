import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const ROOT = process.cwd();

test.describe("CRM admin — dashboard", () => {
  test("centralise les blocs métier attendus sans données fictives", async () => {
    const pageSource = await readFile(`${ROOT}/src/app/admin/page.tsx`, "utf8");
    const querySource = await readFile(
      `${ROOT}/src/server/queries/admin-overview.ts`,
      "utf8",
    );

    for (const label of [
      "Nouvelles inscriptions",
      "Sessions planifiées",
      "Taux d'inscription",
      "Chiffre d'affaires",
      "Inscriptions récentes",
      "Sessions à venir",
      "Activité récente",
    ]) {
      expect(pageSource).toContain(label);
    }

    expect(pageSource).toContain('data-testid="crm-dashboard"');
    expect(pageSource).toContain("getCrmDashboardSnapshot(range)");
    expect(querySource).toContain("prisma.trainingSession");
    expect(querySource).toContain("prisma.registration");
    expect(querySource).toContain("prisma.program");
    expect(pageSource).not.toMatch(/Math\.random|faker|mockData|demoData/i);
  });

  test("préserve le contrôle d'accès du CRM", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.url()).toContain("connexion");
  });
});
