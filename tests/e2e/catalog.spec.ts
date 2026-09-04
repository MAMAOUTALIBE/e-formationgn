// Tests E2E catalogue — protège la refonte Sprint 1 (8 cartes avant « Voir tout »)
// et Sprint 4 (recherche full-text raw SQL avec tie-breaker stable).

import { expect, test } from "@playwright/test";

const CATEGORY_SLUG = "developpement"; // doit exister dans le seed

function extractCourseSlugs(html: string): string[] {
  const matches = html.matchAll(/href="\/cours\/([a-z0-9-]+)"/g);
  return Array.from(new Set(Array.from(matches, (m) => m[1])));
}

test.describe("Catalogue — pagination", () => {
  test("/cours répond 200 et liste des cours", async ({ request }) => {
    const response = await request.get("/cours");
    expect(response.status()).toBe(200);
    const html = await response.text();
    // Le seed embarque 4 cours publiés — au moins 1 doit apparaître.
    expect(extractCourseSlugs(html).length).toBeGreaterThan(0);
  });

  test("pagination page=2 répond 200 (pas de 404 même si vide)", async ({
    request,
  }) => {
    const response = await request.get("/cours?page=2");
    expect(response.status()).toBe(200);
  });

  test("le catalogue affiche au plus 8 cartes puis permet de tout voir", async ({
    request,
  }) => {
    const limited = await request.get("/cours");
    const all = await request.get("/cours?view=all");
    expect(limited.status()).toBe(200);
    expect(all.status()).toBe(200);

    const limitedSlugs = extractCourseSlugs(await limited.text());
    const allHtml = await all.text();
    const allSlugs = extractCourseSlugs(allHtml);
    expect(limitedSlugs.length).toBeLessThanOrEqual(8);
    expect(allSlugs.length).toBeGreaterThanOrEqual(limitedSlugs.length);
    expect(allHtml).not.toContain("Voir toutes les formations →");
  });

  test("page invalide est plafonnée et ne casse pas", async ({ request }) => {
    // courseFiltersSchema plafonne page à 500.
    const response = await request.get("/cours?page=99999");
    expect(response.status()).toBe(200);
    const tooLarge = await request.get("/cours?page=abc");
    expect(tooLarge.status()).toBe(200);
  });
});

test.describe("Catalogue — filtres", () => {
  test("filtre par catégorie restreint la liste", async ({ request }) => {
    const all = await request.get("/cours?view=all");
    const filtered = await request.get(`/cours?category=${CATEGORY_SLUG}`);
    expect(filtered.status()).toBe(200);
    // Au moins une URL diffère — sauf cas pathologique d'une seule catégorie.
    const allSlugs = extractCourseSlugs(await all.text());
    const filteredSlugs = extractCourseSlugs(await filtered.text());
    expect(filteredSlugs.length).toBeGreaterThan(0);
    expect(filteredSlugs.every((s) => allSlugs.includes(s))).toBe(true);
  });

  test("filtre level invalide est ignoré (200, pas 500)", async ({
    request,
  }) => {
    const response = await request.get("/cours?level=NOT_A_LEVEL");
    expect(response.status()).toBe(200);
  });

  test("filtre price=free retourne 200", async ({ request }) => {
    const response = await request.get("/cours?price=free");
    expect(response.status()).toBe(200);
  });

  test("la barre desktop prépare, applique et réinitialise la catégorie", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto("/cours?q=fondamentaux&sort=newest");

    const sidebar = page.getByRole("complementary", {
      name: "Filtres du catalogue",
    });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("heading", { name: "Filtres" })).toBeVisible();

    await expect(sidebar.getByRole("button", { name: "Catégorie" })).toBeVisible();
    for (const removed of ["Note", "Niveau", "Durée"]) {
      await expect(sidebar.getByText(removed, { exact: true })).toHaveCount(0);
    }

    const category = sidebar.locator('input[type="radio"]').nth(1);
    await category.check();
    await expect(page).not.toHaveURL(/category=/);

    await sidebar.getByRole("button", { name: "Appliquer" }).click();
    await expect(page).toHaveURL(/category=/);

    await sidebar.getByRole("button", { name: "Réinitialiser" }).click();
    await expect(category).not.toBeChecked();
    await sidebar.getByRole("button", { name: "Appliquer" }).click();
    await expect(page).not.toHaveURL(/category=/);
    await expect(page).toHaveURL(/q=fondamentaux/);
    await expect(page).toHaveURL(/sort=newest/);
  });
});

test.describe("Catalogue — recherche full-text", () => {
  test("recherche avec terme connu retourne des résultats", async ({
    request,
  }) => {
    // « fondamentaux » est dans le titre du cours seedé et un mot français
    // pleinement tokenizé par to_tsvector('french', …). Évite « next » qui
    // se fait stemmer en `next.js` (un seul token, non match sur préfixe).
    const response = await request.get("/cours?q=fondamentaux");
    expect(response.status()).toBe(200);
    const slugs = extractCourseSlugs(await response.text());
    expect(slugs).toContain("nextjs-fondamentaux-2026");
  });

  test("recherche avec terme inexistant retourne 200 (état vide)", async ({
    request,
  }) => {
    const response = await request.get("/cours?q=zzzzzz-no-match-zzz");
    expect(response.status()).toBe(200);
  });

  test("pagination de recherche est stable (pas de doublon entre pages)", async ({
    request,
  }) => {
    // Régression : Sprint 4 a corrigé le bug où sort=relevance + skip/take
    // Prisma donnaient un ordre incohérent. La SQL refondue + tie-breaker
    // `id ASC` garantit qu'aucun cours n'apparaît sur 2 pages successives.
    const p1 = await request.get("/cours?q=cours&page=1");
    const p2 = await request.get("/cours?q=cours&page=2");
    const s1 = new Set(extractCourseSlugs(await p1.text()));
    const s2 = new Set(extractCourseSlugs(await p2.text()));
    const overlap = Array.from(s1).filter((s) => s2.has(s));
    expect(overlap).toEqual([]);
  });

  test("/api/recherche?q=fondamentaux renvoie JSON valide", async ({
    request,
  }) => {
    const response = await request.get("/api/recherche?q=fondamentaux");
    // 200 attendu ; 429 si saturation rate-limit dans la même run E2E (cf.
    // commentaire dans routes.spec.ts).
    if (response.status() === 429) {
      test.skip(true, "Rate-limit saturé par un test précédent (acceptable).");
    }
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(typeof body).toBe("object");
  });
});

test.describe("Catalogue — sort", () => {
  for (const sort of ["popular", "rating", "newest", "price_asc", "price_desc", "relevance"]) {
    test(`tri "${sort}" répond 200`, async ({ request }) => {
      const response = await request.get(`/cours?sort=${sort}`);
      expect(response.status()).toBe(200);
    });
  }

  test("tri invalide ne casse pas (fallback relevance)", async ({ request }) => {
    const response = await request.get("/cours?sort=not-a-sort");
    expect(response.status()).toBe(200);
  });
});
