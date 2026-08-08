import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const ROOT = process.cwd();

test.describe("CRM admin — sociétés", () => {
  test("la liste centralise les statistiques, filtres et données réelles", async () => {
    const [pageSource, querySource] = await Promise.all([
      readFile(`${ROOT}/src/app/admin/societes/page.tsx`, "utf8"),
      readFile(`${ROOT}/src/server/queries/admin-companies.ts`, "utf8"),
    ]);

    for (const label of [
      "Total des sociétés",
      "Sociétés actives",
      "Sociétés inactives",
      "Sociétés archivées",
      "Toutes les villes",
      "Apprenants",
    ]) {
      expect(pageSource).toContain(label);
    }
    expect(pageSource).toContain('data-testid="companies-workspace"');
    expect(querySource).toContain("getCompanyDashboardStats");
    expect(querySource).toContain("prisma.company.count");
    expect(querySource).toContain("prisma.user.count");
    expect(pageSource).not.toMatch(/Math\.random|faker|mockData|demoData/i);
  });

  test("création et modification partagent le formulaire métier existant", async () => {
    const [newPage, detailPage, formSource, actionsSource] = await Promise.all([
      readFile(`${ROOT}/src/app/admin/societes/nouvelle/page.tsx`, "utf8"),
      readFile(`${ROOT}/src/app/admin/societes/[id]/page.tsx`, "utf8"),
      readFile(`${ROOT}/src/components/features/admin/company-form.tsx`, "utf8"),
      readFile(`${ROOT}/src/server/actions/admin-companies.ts`, "utf8"),
    ]);

    expect(newPage).toContain("<CompanyForm");
    expect(detailPage).toContain("<CompanyForm");
    expect(detailPage).toContain("Apprenants rattachés");
    expect(formSource).toContain("createCompany");
    expect(formSource).toContain("updateCompany");
    expect(formSource).toContain('data-testid="company-form"');
    expect(actionsSource).toContain("requireAnyAdminRole");
    expect(actionsSource).toContain("companySchema.safeParse");
  });

  test("les routes sociétés restent protégées", async ({ page }) => {
    const response = await page.goto("/admin/societes");
    expect(response?.url()).toContain("connexion");
  });
});
