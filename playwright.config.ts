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
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    locale: "fr-FR",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
