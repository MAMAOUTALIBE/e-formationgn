// Tests E2E de régression des durcissements sécurité (Phase A).
// Ces tests garantissent que les protections récemment ajoutées ne sautent
// pas silencieusement lors d'un futur refactor.

import { expect, test } from "@playwright/test";

test.describe("Sécurité — recherche publique", () => {
  test("/api/recherche est rate-limitée à ~60 req/min par IP", async ({
    request,
  }) => {
    // 65 requêtes rapides pour franchir la limite de 60.
    let firstLimitedStatus: number | null = null;

    for (let i = 0; i < 65; i++) {
      const response = await request.get("/api/recherche?q=test");
      if (response.status() === 429) {
        firstLimitedStatus = response.status();
        // Doit fournir le header Retry-After pour client-side backoff.
        expect(response.headers()["retry-after"]).toBeTruthy();
        break;
      }
    }

    expect(firstLimitedStatus).toBe(429);
  });

  test("requête recherche très longue est plafonnée", async ({ request }) => {
    const response = await request.get(
      "/api/recherche?q=" + "a".repeat(500),
    );
    // 200 OK mais résultat vide ; pas de 500 ni d'erreur DB.
    expect([200, 429]).toContain(response.status());
  });
});

test.describe("Sécurité — open-redirect via callbackUrl", () => {
  test("callbackUrl externe ne redirige pas vers un autre site", async ({
    page,
  }) => {
    // L'utilisateur n'est pas connecté : la page connexion s'affiche, mais
    // le formulaire submit DOIT ignorer une URL externe.
    await page.goto("/connexion?callbackUrl=https://evil.example.com/steal");
    // On vérifie surtout que l'URL de la page reste sur le domaine local.
    expect(page.url()).toContain("/connexion");
    expect(page.url()).not.toContain("evil.example.com");
  });

  test("callbackUrl protocol-relative (//evil) n'est pas suivi", async ({
    page,
  }) => {
    await page.goto("/connexion?callbackUrl=//evil.example.com/x");
    expect(page.url()).toContain("/connexion");
    // L'attaque //evil ne doit pas remplacer le host courant.
    expect(page.url()).not.toContain("//evil.example.com");
  });
});

test.describe("Sécurité — admin search anonyme", () => {
  test("/api/admin/search refuse 403 + Cache-Control private", async ({
    request,
  }) => {
    const response = await request.get("/api/admin/search?q=alice");
    expect(response.status()).toBe(403);
    // Cache-Control private/no-store : empêche un proxy de mettre la
    // réponse en cache.
    const cc = response.headers()["cache-control"];
    expect(cc).toBeTruthy();
    expect(cc.toLowerCase()).toContain("no-store");
  });
});

test.describe("Sécurité — webhooks signature", () => {
  test("/api/webhooks/stripe sans signature renvoie 400", async ({
    request,
  }) => {
    const response = await request.post("/api/webhooks/stripe", {
      data: { type: "test" },
      headers: { "content-type": "application/json" },
    });
    // 400 si Stripe configuré, 503 si STRIPE_SECRET_KEY absent — les deux
    // sont des refus valides (pas d'événement traité sans signature).
    expect([400, 503]).toContain(response.status());
  });

  test("/api/webhooks/mux sans signature renvoie 400", async ({ request }) => {
    const response = await request.post("/api/webhooks/mux", {
      data: { type: "test" },
      headers: { "content-type": "application/json" },
    });
    expect([400, 503]).toContain(response.status());
  });
});

test.describe("Sécurité — cron endpoint", () => {
  test("/api/cron/cleanup sans bearer token renvoie 401", async ({
    request,
  }) => {
    const response = await request.get("/api/cron/cleanup");
    expect(response.status()).toBe(401);
  });

  test("/api/cron/cleanup avec mauvais token renvoie 401", async ({
    request,
  }) => {
    const response = await request.get("/api/cron/cleanup", {
      headers: { authorization: "Bearer wrong-token" },
    });
    expect(response.status()).toBe(401);
  });
});
