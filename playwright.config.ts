// Playwright config — tests e2e contre le serveur dev local.
// `npx playwright test` lance les tests contre http://localhost:3000.
// On ne démarre pas le serveur ici (le faire manuellement avant) pour ne
// pas bloquer si un dev server tourne déjà.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // En dev local, on plafonne à 2 workers : `next dev` n'aime pas recevoir
  // simultanément 8 requêtes qui déclenchent chacune un compile (ECONNRESET
  // observés sur les routes lourdes comme /api/og Satori). En CI on reste
  // séquentiel pour la stabilité maximale.
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    locale: "fr-FR",
  },
  // Chromium par défaut : c'est le seul navigateur installé par
  // `npm run test:e2e:install`, et la barrière de déploiement doit rester
  // exécutable sans préparation supplémentaire.
  //
  // Safari représente l'essentiel du trafic mobile en France. Sa couverture est
  // donc déclarée ici, mais derrière un interrupteur explicite pour ne pas
  // casser un poste où WebKit n'est pas téléchargé :
  //
  //   npx playwright install webkit
  //   PLAYWRIGHT_ALL_BROWSERS=1 npm run test:e2e
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ...(process.env.PLAYWRIGHT_ALL_BROWSERS
      ? [
          { name: "webkit", use: { ...devices["Desktop Safari"] } },
          { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
        ]
      : []),
  ],
});
