import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const ROOT = process.cwd();

test.describe("CRM admin — dashboard", () => {
  test("centralise les blocs métier attendus sans données fictives", async () => {
    const pageSource = await readFile(`${ROOT}/src/app/admin/page.tsx`, "utf8");
    for (const label of [
      "Pilotage pédagogique",
      "Sociétés actives",
      "Apprenants actifs",
      "Cours publiés",
      "Inscriptions actives",
      "Gérer les formations",
      "Suivre les apprenants",
      "Analyser l'apprentissage",
    ]) {
      expect(pageSource).toContain(label);
    }

    expect(pageSource).toContain("prisma.company.count");
    expect(pageSource).toContain("prisma.user.count");
    expect(pageSource).toContain("prisma.course.count");
    expect(pageSource).toContain("prisma.enrollment.count");
    expect(pageSource).not.toMatch(/Math\.random|faker|mockData|demoData/i);
  });

  test("préserve le contrôle d'accès du CRM", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.url()).toContain("connexion");
  });
});
