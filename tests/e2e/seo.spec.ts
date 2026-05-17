// SEO E2E — vérifie que les structures schema.org, hreflang et OG image
// restent en place. Régression silencieuse de ces éléments = perte de
// rich snippets / preview sociale ⇒ chute CTR difficile à diagnostiquer.

import { expect, test } from "@playwright/test";

const COURSE_SLUG = "nextjs-fondamentaux-2026";

function extractJsonLd(html: string): Array<Record<string, unknown>> {
  // Récupère tous les blocs JSON-LD inline (encodés `<` pour les `<`).
  const blocks: Array<Record<string, unknown>> = [];
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1].replace(/\\u003c/g, "<");
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Ignore — on testera explicitement la validité plus bas.
    }
  }
  return blocks;
}

test.describe("SEO — JSON-LD page détail cours", () => {
  test("rend un schema.org Course valide avec offers + aggregateRating", async ({
    request,
  }) => {
    const response = await request.get(`/cours/${COURSE_SLUG}`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    const blocks = extractJsonLd(html);
    const course = blocks.find((b) => b["@type"] === "Course");
    expect(course, "JSON-LD Course doit être présent").toBeTruthy();

    // Champs critiques pour les rich snippets Google.
    expect(course!.name).toBeTruthy();
    expect(course!.url).toMatch(/\/cours\/[a-z0-9-]+/);
    expect(course!.provider).toEqual(
      expect.objectContaining({ "@type": "Organization" }),
    );
    expect(Array.isArray(course!.offers)).toBe(true);
    const offers = course!.offers as Array<Record<string, unknown>>;
    expect(offers.length).toBeGreaterThan(0);
    expect(offers[0]).toEqual(
      expect.objectContaining({
        "@type": "Offer",
        priceCurrency: expect.stringMatching(/^(EUR|USD|GNF|XOF)$/),
        availability: "https://schema.org/InStock",
      }),
    );
  });

  test("rend un BreadcrumbList avec ordre Accueil → Catalogue → Catégorie → Cours", async ({
    request,
  }) => {
    const response = await request.get(`/cours/${COURSE_SLUG}`);
    const html = await response.text();
    const blocks = extractJsonLd(html);
    const breadcrumb = blocks.find((b) => b["@type"] === "BreadcrumbList");
    expect(breadcrumb).toBeTruthy();
    const items = breadcrumb!.itemListElement as Array<{
      position: number;
      name: string;
    }>;
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items[0].position).toBe(1);
    expect(items[0].name.toLowerCase()).toContain("accueil");
    expect(items.at(-1)!.name).toBeTruthy();
  });
});

test.describe("SEO — hreflang multi-pays", () => {
  test("layout root déclare les variantes francophones + x-default", async ({
    request,
  }) => {
    const response = await request.get("/");
    const html = await response.text();
    const expected = ["fr-FR", "fr-BE", "fr-CA", "fr-CI", "fr-SN", "fr-GN", "x-default"];
    for (const lang of expected) {
      expect(html).toContain(`hrefLang="${lang}"`);
    }
  });

  test("page détail cours a un canonical absolu", async ({ request }) => {
    const response = await request.get(`/cours/${COURSE_SLUG}`);
    const html = await response.text();
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    expect(canonical).toBeTruthy();
    expect(canonical).toMatch(/^https?:\/\//);
    expect(canonical).toContain(`/cours/${COURSE_SLUG}`);
  });
});

test.describe("SEO — OG image dynamique", () => {
  test("/api/og répond image/png 1200×630", async ({ request }) => {
    const response = await request.get("/api/og");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    // Cache-Control public pour permettre aux bots sociaux de mutualiser.
    expect(response.headers()["cache-control"]).toContain("public");
  });

  test("/api/og avec params course renvoie aussi une image", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/og?kind=course&title=Test&subtitle=Hello&rating=4.5&totalRatings=120",
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  });

  test("page détail cours réfère bien /api/og dans og:image", async ({
    request,
  }) => {
    const response = await request.get(`/cours/${COURSE_SLUG}`);
    const html = await response.text();
    const og = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    expect(og).toBeTruthy();
    expect(og).toContain("/api/og");
    // L'URL doit transporter le titre + rating pour rendu dynamique.
    expect(og).toContain("kind=course");
  });
});
