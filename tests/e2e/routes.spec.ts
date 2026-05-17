// Couverture HTTP « tableau de bord » — chaque route publique / protégée
// répond le code attendu. Ajoute une ligne quand une nouvelle route apparaît
// pour qu'un changement de RBAC ou de proxy se voie immédiatement.

import { expect, test } from "@playwright/test";

interface RouteCase {
  path: string;
  // 200 attendu = public.
  // 302 attendu = redirige vers /connexion (route protégée, user anonyme).
  // 401/403 = auth requise (API).
  // 404 = ressource manquante.
  // 405 = méthode non autorisée (webhooks GET).
  expected: number | number[];
}

const PUBLIC_PAGES: RouteCase[] = [
  { path: "/", expected: 200 },
  { path: "/cours", expected: 200 },
  { path: "/categories", expected: 200 },
  { path: "/devenir-formateur", expected: 200 },
  { path: "/a-propos", expected: 200 },
  { path: "/contact", expected: 200 },
  { path: "/cgv", expected: 200 },
  { path: "/mentions-legales", expected: 200 },
  { path: "/confidentialite", expected: 200 },
  { path: "/cookies", expected: 200 },
  { path: "/credits", expected: 200 },
  { path: "/connexion", expected: 200 },
  { path: "/inscription", expected: 200 },
  { path: "/mot-de-passe-oublie", expected: 200 },
  { path: "/sitemap.xml", expected: 200 },
  { path: "/robots.txt", expected: 200 },
];

const PROTECTED_PAGES: RouteCase[] = [
  { path: "/admin", expected: 302 },
  { path: "/formateur", expected: 302 },
  { path: "/profil", expected: 302 },
  { path: "/apprentissage", expected: 302 },
  { path: "/panier", expected: 302 },
  { path: "/wishlist", expected: 302 },
  { path: "/notifications", expected: 302 },
];

const APIS: RouteCase[] = [
  { path: "/api/health", expected: 200 },
  { path: "/api/og", expected: 200 },
  // 200 normalement, 429 si un test précédent du même run a saturé le
  // rate-limit (60 req/min/IP — partagée en `npm run test:e2e` qui frappe
  // tout depuis localhost). Cf. security.spec.ts:rate-limit.
  { path: "/api/recherche?q=test", expected: [200, 429] },
  { path: "/api/admin/search?q=test", expected: 403 },
  { path: "/api/cron/cleanup", expected: 401 },
];

const WEBHOOKS_GET: RouteCase[] = [
  // Les webhooks acceptent uniquement POST avec signature.
  { path: "/api/webhooks/stripe", expected: 405 },
  { path: "/api/webhooks/mux", expected: 405 },
  { path: "/api/webhooks/cinetpay", expected: 405 },
];

test.describe("Couverture HTTP — pages publiques", () => {
  for (const { path, expected } of PUBLIC_PAGES) {
    test(`GET ${path} → ${expected}`, async ({ request }) => {
      const r = await request.get(path, { maxRedirects: 0 });
      const statuses = Array.isArray(expected) ? expected : [expected];
      expect(statuses).toContain(r.status());
    });
  }
});

test.describe("Couverture HTTP — pages protégées (302 vers /connexion)", () => {
  for (const { path } of PROTECTED_PAGES) {
    test(`GET ${path} redirige vers /connexion`, async ({ request }) => {
      const r = await request.get(path, { maxRedirects: 0 });
      expect(r.status()).toBe(302);
      expect(r.headers().location).toContain("/connexion");
    });
  }
});

test.describe("Couverture HTTP — APIs", () => {
  for (const { path, expected } of APIS) {
    test(`GET ${path} → ${expected}`, async ({ request }) => {
      const r = await request.get(path, { maxRedirects: 0 });
      const statuses = Array.isArray(expected) ? expected : [expected];
      expect(statuses).toContain(r.status());
    });
  }
});

test.describe("Couverture HTTP — webhooks", () => {
  for (const { path, expected } of WEBHOOKS_GET) {
    test(`GET ${path} → ${expected} (POST attendu)`, async ({ request }) => {
      const r = await request.get(path, { maxRedirects: 0 });
      const statuses = Array.isArray(expected) ? expected : [expected];
      expect(statuses).toContain(r.status());
    });
  }
});
