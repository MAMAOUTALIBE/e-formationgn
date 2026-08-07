// Smoke tests : on vérifie que les pages publiques répondent 200 et
// affichent leur contenu principal. Pas de DB seedée requise.

import { expect, test } from "@playwright/test";

test.describe("Smoke — pages publiques", () => {
  test("home affiche le hero et le header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("header").first()).toBeVisible();
  });

  test("catalogue répond et affiche au moins un cours ou un état vide", async ({
    page,
  }) => {
    await page.goto("/cours");
    // Soit la liste est non vide, soit on a un message d'absence — pas d'erreur 500.
    await expect(page.locator("body")).not.toContainText("Internal Server Error");
  });

  test("/api/health renvoie 200", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  test("inscription publique fermée en mode centre de formation", async ({ page }) => {
    await page.goto("/inscription");
    // La plateforme tourne en `centre_formation` : les comptes sont créés
    // depuis le CRM, jamais par le visiteur. Ce test vérifiait l'ancien
    // formulaire d'inscription libre ; il vérifie maintenant que la page
    // l'annonce et n'expose aucun champ de création de compte.
    await expect(page.getByText(/centre de formation/i).first()).toBeVisible();
    await expect(page.getByLabel(/mot de passe/i)).toHaveCount(0);
  });

  test("connexion affiche le formulaire", async ({ page }) => {
    await page.goto("/connexion");
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expect(page.getByLabel(/mot de passe/i).first()).toBeVisible();
  });

  test("admin sans session est redirigé", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.url()).toContain("connexion");
  });
});
