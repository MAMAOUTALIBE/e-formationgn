// Sondes de sécurité complémentaires — injection, fuite de données, upload.
//
// Aucune de ces sondes n'est destructive : elles envoient des entrées hostiles
// et vérifient la réaction, sans jamais chercher à détruire ou exfiltrer.

import { expect, test, type Browser, type Page } from "@playwright/test";

import { login, type QaRole } from "./helpers/auth";

async function signedInPage(browser: Browser, role: QaRole): Promise<Page> {
  const page = await browser.newPage();
  expect(await login(page, role), `connexion ${role}`).toBe(true);
  return page;
}

test.describe("Injection — la recherche publique", () => {
  const PAYLOADS = [
    "' OR '1'='1",
    "'; DROP TABLE \"User\"; --",
    "1' UNION SELECT email, hashedPassword FROM \"User\" --",
    "%' OR 1=1 --",
    "\\'; SELECT pg_sleep(5); --",
  ];

  for (const payload of PAYLOADS) {
    test(`résiste à « ${payload.slice(0, 28)} »`, async ({ request }) => {
      const response = await request.get(
        `/api/recherche?q=${encodeURIComponent(payload)}`,
      );
      // Jamais 500 : une erreur serveur signalerait que la charge atteint le moteur.
      expect([200, 429]).toContain(response.status());
      if (response.status() !== 200) return;
      const body = await response.text();
      // Ni fuite de schéma, ni fuite d'identifiants.
      expect(body).not.toMatch(/hashedPassword|\$2[aby]\$|PrismaClient|syntax error/i);
    });
  }

  test("la table User est toujours là après les charges d'injection", async ({ request }) => {
    // Contrôle a posteriori : si un DROP avait abouti, le catalogue tomberait.
    const response = await request.get("/api/recherche?q=formation");
    expect([200, 429]).toContain(response.status());
  });
});

test.describe("Injection — filtres du catalogue", () => {
  const CASES = [
    "/cours?page=-1",
    "/cours?page=999999999",
    "/cours?page=abc",
    "/cours?level=' OR 1=1--",
    "/cours?sort=;DROP",
    "/cours?category=%00",
    "/cours?q=" + "a".repeat(2000),
  ];

  for (const target of CASES) {
    test(`${target.slice(0, 42)} ne casse pas`, async ({ request }) => {
      const response = await request.get(target);
      expect(response.status(), `${target} a renvoyé ${response.status()}`).toBeLessThan(500);
    });
  }
});

test.describe("Fuite de données", () => {
  test("aucune variable d'environnement secrète n'atteint le navigateur", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const html = await page.content();
    for (const secret of [
      "NEXTAUTH_SECRET",
      "DATABASE_URL",
      "CRON_SECRET",
      "STRIPE_SECRET_KEY",
      "R2_SECRET_ACCESS_KEY",
      "LIVEKIT_API_SECRET",
      "postgresql://",
    ]) {
      expect(html, `« ${secret} » apparaît dans la page`).not.toContain(secret);
    }
  });

  test("la page publique d'une formation ne révèle pas les notes internes", async ({ request }) => {
    const html = await (await request.get("/cours/qa-formation-formateur-un")).text();
    expect(html).not.toMatch(/internalNotes|adminNote/i);
  });

  test("l'API de recherche ne renvoie ni email ni empreinte de mot de passe", async ({ request }) => {
    const body = await (await request.get("/api/recherche?q=qa")).text();
    expect(body).not.toMatch(/@audit\.local|hashedPassword|\$2[aby]\$/);
  });

  test("le healthcheck ne décrit pas l'infrastructure", async ({ request }) => {
    const body = await (await request.get("/api/health")).text();
    expect(body).not.toMatch(/postgresql:\/\/|password|127\.0\.0\.1:\d+|version/i);
  });
});

test.describe("Cookies de session", () => {
  test("le cookie de session est httpOnly et sameSite", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    expect(await login(page, "student")).toBe(true);
    const cookies = await context.cookies();
    const session = cookies.find((cookie) => /authjs|next-auth/i.test(cookie.name));
    expect(session, "aucun cookie de session trouvé").toBeTruthy();
    expect(session!.httpOnly, "le cookie de session doit être httpOnly").toBe(true);
    expect(["Lax", "Strict"]).toContain(session!.sameSite);
    await context.close();
  });
});

test.describe("Téléversement — types de fichiers", () => {
  test("la demande d'URL signée refuse un exécutable", async ({ browser }) => {
    const page = await signedInPage(browser, "instructor");
    const outcomes: { name: string; status: number; body: string }[] = [];
    for (const filename of ["exploit.php", "shell.sh", "payload.html", "malware.exe", "x.svg"]) {
      const result = await page.evaluate(async (name) => {
        const response = await fetch("/api/upload/course-thumbnail", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ filename: name, contentType: "application/octet-stream" }),
        });
        return { status: response.status, body: (await response.text()).slice(0, 200) };
      }, filename);
      outcomes.push({ name: filename, ...result });
    }
    for (const outcome of outcomes) {
      expect(
        outcome.status,
        `${outcome.name} accepté (${outcome.status}) : ${outcome.body}`,
      ).not.toBe(200);
    }
    await page.close();
  });

  test("un élève ne peut pas demander d'URL de téléversement de vignette", async ({ browser }) => {
    const page = await signedInPage(browser, "student");
    const status = await page.evaluate(async () => {
      const response = await fetch("/api/upload/course-thumbnail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: "photo.jpg", contentType: "image/jpeg" }),
      });
      return response.status;
    });
    expect([401, 403]).toContain(status);
    await page.close();
  });
});

test.describe("Traversée de chemin — fichiers servis", () => {
  const TRAVERSALS = [
    "/uploads/../../.env",
    "/uploads/..%2f..%2f.env",
    "/uploads/....//....//.env",
    "/uploads/resources/secret.pdf",
  ];

  for (const target of TRAVERSALS) {
    test(`${target} ne sert aucun fichier`, async ({ request }) => {
      const response = await request.get(target, { maxRedirects: 0 });
      expect(response.status(), `${target} a répondu ${response.status()}`).not.toBe(200);
    });
  }
});
