import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

test.describe("Séparation équipe et apprenants", () => {
  test("l’espace équipe reste protégé pour un visiteur anonyme", async ({ page }) => {
    await page.goto("/admin/equipe");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("les rôles internes ne peuvent pas être convertis implicitement en élèves", async () => {
    const [pageSource, actionsSource, detailSource] = await Promise.all([
      readFile(path.join(root, "src/app/admin/equipe/page.tsx"), "utf8"),
      readFile(path.join(root, "src/server/actions/admin-security.ts"), "utf8"),
      readFile(path.join(root, "src/app/admin/utilisateurs/[id]/page.tsx"), "utf8"),
    ]);

    expect(pageSource).toContain('data-testid="staff-workspace"');
    expect(pageSource).toContain('session?.user?.role !== "ADMIN"');
    expect(pageSource).toContain('role: { in: [...STAFF_ROLES] }');
    expect(actionsSource).toContain("!isStaffRole(user.role)");
    expect(actionsSource).not.toContain('data: { role: "STUDENT"');
    expect(detailSource).not.toContain('<option value="STUDENT">');
  });
});
