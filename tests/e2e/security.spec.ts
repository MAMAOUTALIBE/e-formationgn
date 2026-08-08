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
  // Le test vérifie que la **page courante** reste sur le domaine local
  // (host = localhost / 127.0.0.1) après la navigation. Le query string peut
  // contenir la chaîne malveillante — ce qui compte c'est qu'aucune
  // redirection externe n'ait eu lieu.
  test("callbackUrl externe ne redirige pas vers un autre site", async ({
    page,
    baseURL,
  }) => {
    await page.goto("/connexion?callbackUrl=https://evil.example.com/steal");
    expect(new URL(page.url()).host).toBe(new URL(baseURL!).host);
    expect(page.url()).toContain("/connexion");
  });

  test("callbackUrl protocol-relative (//evil) n'est pas suivi", async ({
    page,
    baseURL,
  }) => {
    await page.goto("/connexion?callbackUrl=//evil.example.com/x");
    expect(new URL(page.url()).host).toBe(new URL(baseURL!).host);
    expect(page.url()).toContain("/connexion");
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

test.describe("Sécurité — routes publiques (régression Sprint 1/3)", () => {
  test("/credits est public (200, pas de redirect vers /connexion)", async ({
    request,
  }) => {
    // Régression Sprint 1 : avait été oubliée dans PUBLIC_ROUTES et tombait en
    // 302 → /connexion. Les pages de mentions / attributions doivent rester
    // accessibles sans session.
    const response = await request.get("/credits", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
  });

  test("/api/og est public (le bot social n'a pas de cookies)", async ({
    request,
  }) => {
    // Régression Sprint 3 : sans la whitelist dans auth.config, le crawler
    // Twitter/LinkedIn se prendrait un 302 et l'image ne serait jamais générée.
    const response = await request.get("/api/og", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  });

  test("/api/track accepte POST (analytics anonymes)", async ({ request }) => {
    const response = await request.post("/api/track", {
      data: { path: "/test" },
      headers: { "content-type": "application/json" },
    });
    // 200 ou 204 — l'important c'est qu'on n'ait pas de 401/403/302.
    expect([200, 204]).toContain(response.status());
  });
});

test.describe("Sécurité — en-têtes HTTP globaux", () => {
  test("la home expose les en-têtes de sécurité critiques", async ({
    request,
  }) => {
    const response = await request.get("/");
    const headers = response.headers();
    // Définis dans next.config.ts.
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["strict-transport-security"]).toContain("max-age");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    // CSP en report-only — surveillé mais pas bloquant.
    expect(headers["content-security-policy-report-only"]).toBeTruthy();
  });
});

test.describe("Sécurité — cache PWA", () => {
  test("le service worker applique une allowlist publique stricte", async ({
    request,
  }) => {
    const response = await request.get("/sw.js");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("javascript");

    const source = await response.text();
    expect(source).toContain('const CACHE_VERSION = "efgn-v2"');
    expect(source).toContain("PUBLIC_PAGE_ALLOWLIST.has(url.pathname)");
    expect(source).toContain('cacheControl.includes("private")');
    expect(source).toContain('cacheControl.includes("no-store")');

    // Les familles privées ne doivent jamais devenir des préfixes cacheables.
    for (const privatePrefix of ["/admin", "/formateur", "/api/", "/connexion"]) {
      expect(source).not.toContain(`url.pathname.startsWith("${privatePrefix}")`);
    }
  });
});
