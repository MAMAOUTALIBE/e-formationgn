// Test de fumée authentifié sur l'espace d'administration.
//
// Raison d'être : deux écrans du CRM sont partis en production avec une erreur
// de rendu serveur (`ReferenceError: status is not defined` sur la liste des
// apprenants, appel d'une fonction « use client » depuis un composant serveur
// sur la fiche). Aucune barrière ne pouvait les voir — typecheck, lint et les
// tests unitaires étaient au vert, et aucun test n'ouvrait un écran admin avec
// une session. Ce fichier comble exactement ce trou : il charge chaque écran et
// échoue dès qu'une frontière d'erreur s'affiche.
//
// Les identifiants viennent de l'environnement ; sans eux la suite est ignorée,
// de sorte qu'un poste de développement sans base de démonstration ne casse pas.
//
//   E2E_ADMIN_EMAIL=admin@exemple.fr E2E_ADMIN_PASSWORD='…' npx playwright test admin-smoke

import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

/**
 * Textes affichés par les frontières d'erreur du CRM. Une page qui plante ne
 * renvoie pas un code HTTP d'erreur — React rend le `error.tsx` du segment avec
 * un HTTP 200. Le seul signal fiable est donc le contenu.
 */
const ERROR_BOUNDARY = [
  "Impossible de charger",
  "Une erreur est survenue",
  "erreur est survenue pendant le chargement",
  "Application error",
];

/** Un écran par entrée du menu, plus les fiches de détail. */
const SCREENS = [
  "/admin",
  "/admin/utilisateurs",
  "/admin/formateurs",
  "/admin/societes",
  "/admin/cours",
  "/admin/formations",
  "/admin/categories",
  "/admin/equipe",
  "/admin/moderation",
  "/admin/support/tickets",
  "/admin/securite",
  "/admin/securite/audit",
  "/admin/securite/rgpd",
  "/admin/securite/sessions",
  "/admin/analytics",
  "/admin/analytics/apprentissage",
  "/admin/cms",
  "/admin/parametres",
  "/admin/assistant",
  "/admin/assistant/sources",
  "/admin/assistant/conversations",
  "/admin/assistant/questions",
  "/admin/assistant/prospects",
];

/** Les filtres sont rendus par des sous-composants : on les exerce aussi. */
const FILTERED = [
  "/admin/utilisateurs?status=ACTIVE",
  "/admin/utilisateurs?status=SUSPENDED&country=FR",
  "/admin/cours?status=DRAFT",
  "/admin/cours?status=PUBLISHED",
  "/admin/formateurs?status=ACTIVE",
];

test.describe("Espace admin — test de fumée authentifié", () => {
  test.skip(
    !EMAIL || !PASSWORD,
    "Définir E2E_ADMIN_EMAIL et E2E_ADMIN_PASSWORD pour exécuter ce test.",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/connexion");
    await page.waitForLoadState("networkidle");

    const bouton = page.getByRole("button", { name: /se connecter/i });
    await bouton.waitFor({ state: "visible" });
    await page.getByLabel(/e-?mail/i).fill(EMAIL!);
    await page.getByLabel(/mot de passe/i).first().fill(PASSWORD!);

    // La soumission déclenche parfois la première compilation de la route en
    // développement : on attend le changement d'URL, pas seulement le réseau.
    await bouton.click();
    await page.waitForURL((url) => !url.pathname.startsWith("/connexion"), {
      timeout: 45_000,
    });
  });

  test("chaque écran se rend sans frontière d'erreur", async ({ page }) => {
    // Généreux : en développement, chaque route est compilée à la volée lors de
    // sa première visite. En production le parcours complet prend quelques
    // secondes.
    test.setTimeout(600_000);
    const casses: string[] = [];

    for (const url of [...SCREENS, ...FILTERED]) {
      // Une seconde tentative en cas d'échec de transport : `next dev` compile
      // les routes à la volée et interrompt parfois la navigation en cours
      // (net::ERR_ABORTED). Ce n'est pas une erreur de rendu — ce que ce test
      // traque, c'est la frontière d'erreur, pas la latence de compilation.
      let charge = false;
      let dernierEchec = "";
      for (let tentative = 0; tentative < 2 && !charge; tentative++) {
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
          charge = true;
        } catch (erreur) {
          dernierEchec = String(erreur).split("\n")[0];
        }
      }
      if (!charge) {
        casses.push(`${url} → chargement impossible (${dernierEchec})`);
        continue;
      }
      const texte = await page.locator("body").innerText();

      if (page.url().includes("/connexion")) {
        casses.push(`${url} → renvoyé vers la page de connexion`);
        continue;
      }
      const boundary = ERROR_BOUNDARY.find((motif) => texte.includes(motif));
      if (boundary) casses.push(`${url} → « ${boundary} »`);
    }

    expect(casses, `Écrans en erreur :\n  ${casses.join("\n  ")}`).toEqual([]);
  });

  test("les écrans à filtres exposent bien leurs listes déroulantes", async ({ page }) => {
    // Une barre de filtres qui plante fait disparaître ses <select> avant même
    // d'afficher la frontière d'erreur : compter les contrôles attrape le défaut
    // même si le libellé de l'erreur venait à changer.
    for (const url of ["/admin/utilisateurs", "/admin/cours", "/admin/formateurs", "/admin/societes"]) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const selects = await page.locator("select").count();
      expect(selects, `${url} devrait exposer au moins un filtre`).toBeGreaterThan(0);
    }
  });
});
